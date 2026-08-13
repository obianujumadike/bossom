import os
import requests
from pathlib import Path
from dotenv import load_dotenv
import pydicom

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

def validate_mammogram_dicom(path):
    path=Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"DICOM file not found: {path}")
    try:
        dataset = pydicom.dcmread(path, stop_before_pixels=True)
    except (pydicom.errors.InvalidDicomError, OSError) as error:
        raise ValueError(f"Could not read DICOM file: {path}") from error
    
    modality=getattr(dataset, "Modality",None)
    body_part=getattr(dataset, "BodyPartExamined",None)
    view_position = getattr(dataset, "ViewPosition", None)
    laterality = getattr(dataset, "ImageLaterality", None)

    if modality!="MG":
        raise ValueError(f"File is not identified as a mammogram image :{path}")
    if body_part != "BREAST":
        raise ValueError(f"File is not identified as a breast image: {path}")
    if view_position not in ["CC", "MLO"]:
        raise ValueError(f"Unsupported view position '{view_position}' in file: {path}")
    if laterality not in ["L", "R"]:
        raise ValueError(f"Unsupported laterality '{laterality}' in file : {path}")
    
    return {"modality": modality,"body_part": body_part,"view_position": view_position,"laterality": laterality,}


def validate_mammogram_views(ccl_path, ccr_path, mlol_path, mlor_path):
    files={"CCL": ccl_path, "CCR":ccr_path, "MLOL":mlol_path, "MLOR":mlor_path}
    metadata={}
    for view_name, path in files.items():
        metadata[view_name]=validate_mammogram_dicom(path)
    expected_views = {"CCL": ("CC", "L"),"CCR": ("CC", "R"),"MLOL": ("MLO", "L"),"MLOR": ("MLO", "R"),}

    for view_name, (expected_position, expected_laterality) in expected_views.items():
        actual_position = metadata[view_name]["view_position"]
        actual_laterality = metadata[view_name]["laterality"]  
        if actual_position != expected_position:
            raise ValueError(f"{view_name} must be {expected_position}, "f"but got {actual_position}")

        if actual_laterality != expected_laterality:
            raise ValueError(f"{view_name} must be {expected_laterality}, "f"but got {actual_laterality}")

    return metadata 



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


