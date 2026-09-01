from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from openpyxl import Workbook

from scripts.email_photo_request import (
    active_recipient_emails,
    build_message,
    default_mail_app_url,
    gmail_compose_url,
)


class EmailPhotoRequestTests(unittest.TestCase):
    def test_message_does_not_expose_bcc_header(self) -> None:
        message = build_message("organizacion@example.com", "organizacion@example.com", "", "https://example.com/foto")
        self.assertNotIn("Bcc", message)
        self.assertEqual(message["To"], "organizacion@example.com")

    def test_manual_compose_urls_do_not_contain_participant_addresses(self) -> None:
        message = build_message("", "organizacion@example.com", "", "https://example.com/foto")
        gmail_url = gmail_compose_url(message, "organizacion@example.com")
        mail_app_url = default_mail_app_url(message, "organizacion@example.com")
        self.assertIn("mail.google.com", gmail_url)
        self.assertIn("organizacion%40example.com", gmail_url)
        self.assertIn("mailto:organizacion%40example.com", mail_app_url)
        self.assertNotIn("participant@example.com", gmail_url)
        self.assertNotIn("participant@example.com", mail_app_url)

    def test_filters_active_unique_and_missing_photo(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "participantes.xlsx"
            workbook = Workbook()
            sheet = workbook.active
            sheet.title = "Participantes"
            sheet.append(["Email", "Estado", "Foto"])
            sheet.append(["ACTIVE@example.com", "Confirmado", "Pendiente"])
            sheet.append(["active@example.com", "Confirmado", "Pendiente"])
            sheet.append(["done@example.com", "Confirmado", "Cargada"])
            sheet.append(["inactive@example.com", "Desactivado", "Pendiente"])
            workbook.save(path)
            workbook.close()

            self.assertEqual(active_recipient_emails(path), ["active@example.com"])
            self.assertEqual(
                active_recipient_emails(path, only_missing_photo=False),
                ["active@example.com", "done@example.com"],
            )


if __name__ == "__main__":
    unittest.main()
