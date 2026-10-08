drop policy if exists "Users can read their own RFP files" on storage.objects;
drop policy if exists "Users can upload their own RFP files" on storage.objects;
drop policy if exists "Users can update their own RFP files" on storage.objects;
drop policy if exists "Users can delete their own RFP files" on storage.objects;

create policy "Users can read their own RFP files"
  on storage.objects for select
  using (
    bucket_id = 'rfp-files'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  );

create policy "Users can upload their own RFP files"
  on storage.objects for insert
  with check (
    bucket_id = 'rfp-files'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  );

create policy "Users can update their own RFP files"
  on storage.objects for update
  using (
    bucket_id = 'rfp-files'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'rfp-files'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  );

create policy "Users can delete their own RFP files"
  on storage.objects for delete
  using (
    bucket_id = 'rfp-files'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  );
