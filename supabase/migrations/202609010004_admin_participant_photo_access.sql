drop policy if exists participant_photos_admin_read on storage.objects;

create policy participant_photos_admin_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'participant-photos'
  and private.is_admin()
);

comment on policy participant_photos_admin_read on storage.objects is
'Allows active Break The Beat administrators to view and download participant photos while the bucket remains private.';
