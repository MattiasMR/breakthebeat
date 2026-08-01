-- Capacity only needs enforcement when an entry is created or reactivated.
-- Deleting a participant category can only free capacity. The registration
-- delete trigger already serializes full-registration deletions, while this
-- child trigger cannot reliably look up a participant during a cascade.
drop trigger if exists participant_categories_capacity_delete
on public.participant_categories;
