import os
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
MIRAI_URL = os.getenv("MIRAI_URL")
if not MIRAI_URL:
    raise RuntimeError("MIRAI_URL environment variable is not set.")

def check_mirai_health():
    try:
        health_response = requests.get(f"{MIRAI_URL}/info",timeout=10,)
        health_response.raise_for_status()
    except requests.RequestException as error:
        raise RuntimeError(f"Mirai service is unavailable: {error}") from error
    return health_response.json()


def predict_risk(ccl_path,ccr_path,mlol_path,mlor_path):
    ccl_path = Path(ccl_path)
    ccr_path = Path(ccr_path)
    mlol_path = Path(mlol_path)
    mlor_path = Path(mlor_path)

    files_to_validate = {
        "CCL": ccl_path,
        "CCR": ccr_path,
        "MLOL": mlol_path,
        "MLOR": mlor_path,
    }

    for view_name, path in files_to_validate.items():
        if not path.is_file():
            raise FileNotFoundError(f"{view_name} mammogram file not found: {path}")

    with (open(ccl_path, "rb") as ccl,open(ccr_path, "rb") as ccr,open(mlol_path, "rb") as mlol,open(mlor_path, "rb") as mlor,):
        files = [("dicom", ccl),("dicom", ccr),("dicom", mlol),("dicom", mlor),]
        try:
            prediction_response = requests.post(
                f"{MIRAI_URL}/dicom/files",
                data={"data": "{}"},
                files=files,
                timeout=120,
            )
            prediction_response.raise_for_status()

        except requests.RequestException as error:
            raise RuntimeError(f"Mirai inference request failed: {error}" ) from error

    result = prediction_response.json()
    predictions = result["data"]["predictions"]

    return predictions


if __name__== "__main__":
    DEMO_FOLDER = Path("data/demo")
    CCL = DEMO_FOLDER / "ccl1.dcm"
    CCR = DEMO_FOLDER / "ccr1.dcm"
    MLOL = DEMO_FOLDER / "mlol2.dcm"
    MLOR = DEMO_FOLDER / "mlor2.dcm"
    health = check_mirai_health()
    print(health)
    predictions = predict_risk(CCL,CCR,MLOL,MLOR,)
    print(predictions)