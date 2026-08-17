import pydicom
from pathlib import Path


DEMO_FOLDER = Path("data/demo")

files = [
    DEMO_FOLDER / "ccl1.dcm",
    DEMO_FOLDER / "ccr1.dcm",
    DEMO_FOLDER / "mlol2.dcm",
    DEMO_FOLDER / "mlor2.dcm",
]


for path in files:
    dataset = pydicom.dcmread(path)
    print(f"FILE: {path.name}")
    print("=" * 30)

    print(f"Modality: {dataset.get('Modality', 'MISSING')}")
    print(f"SOP Class: {dataset.get('SOPClassUID', 'MISSING')}")
    print(f"Body Part: {dataset.get('BodyPartExamined', 'MISSING')}")
    print(f"View Position: {dataset.get('ViewPosition', 'MISSING')}")
    print(f"Image Laterality: {dataset.get('ImageLaterality', 'MISSING')}")