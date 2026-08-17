from pathlib import Path
from mirai_client import validate_mammogram_dicom

DEMO_FOLDER = Path("data/demo")
files = {
    "CCL": DEMO_FOLDER / "ccl1.dcm",
    "CCR": DEMO_FOLDER / "ccr1.dcm",
    "MLOL": DEMO_FOLDER / "mlol2.dcm",
    "MLOR": DEMO_FOLDER / "mlor2.dcm",
}

for view_name, path in files.items():
    print(f"\nTesting {view_name}: {path}")
    result = validate_mammogram_dicom(path)
    print(result)

print("\nTesting invalid file:")
try:
    validate_mammogram_dicom(DEMO_FOLDER / "not_a_mammogram.txt")
except ValueError as error:
    print(f"Rejected correctly: {error}")