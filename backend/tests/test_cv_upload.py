from core.cv_upload import is_allowed_cv_filename, is_cv_image_filename


def test_allows_pdf_docx_and_images():
    assert is_allowed_cv_filename("resume.pdf")
    assert is_allowed_cv_filename("cv.DOCX")
    assert is_allowed_cv_filename("scan.png")
    assert is_cv_image_filename("photo.jpeg")


def test_rejects_unsupported_extensions():
    assert not is_allowed_cv_filename("file.exe")
    assert not is_allowed_cv_filename(None)
    assert not is_cv_image_filename("doc.pdf")
