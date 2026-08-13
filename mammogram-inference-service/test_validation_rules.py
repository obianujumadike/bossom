from pathlib import Path
import tempfile
import pydicom
from pydicom.dataset import FileDataset

from mirai_client import validate_mammogram_dicom


def create_test_dicom(modality, body_part, view_position, laterality):
    with tempfile.NamedTemporaryFile(suffix=".dcm", delete=False) as temp:
        path = Path(temp.name)

    dataset = FileDataset(
        str(path),
        {},
        file_meta=pydicom.dataset.FileMetaDataset(),
        preamble=b"\0" * 128,
    )

    dataset.Modality = modality
    dataset.BodyPartExamined = body_part
    dataset.ViewPosition = view_position
    dataset.ImageLaterality = laterality

    dataset.save_as(path)

    return path

test_file = create_test_dicom(
    modality="CT",
    body_part="HEAD",
    view_position="AXIAL",
    laterality=None,
)

try:
    result = validate_mammogram_dicom(test_file)
    print("ERROR: invalid file was accepted!")
    print(result)

except ValueError as error:
    print(f"Rejected correctly: {error}")

finally:
    test_file.unlink()