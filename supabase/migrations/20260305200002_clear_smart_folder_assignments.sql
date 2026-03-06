-- Clear folder_id on contacts that point to a smart folder.
-- Smart folders are sidebar-only saved searches and must not be stored on contact cards.
UPDATE contacts
SET folder_id = NULL
WHERE folder_id IN (SELECT id FROM folders WHERE is_smart_folder = true);
