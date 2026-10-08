-- Truman's Class on The Day Ahead. One row per school week.
-- Additive. Apply after merge; the press prints without this table.

create table if not exists public.times_class_newsletter (
  week_of date primary key,
  teacher text not null,
  learning jsonb not null default '[]'::jsonb,
  reminders jsonb not null default '[]'::jsonb,
  upcoming jsonb not null default '[]'::jsonb,
  received_at timestamptz not null default now()
);

comment on table public.times_class_newsletter is
  'Thompson Times: Truman''s class letter for the school week of week_of. Service role writes; authenticated reads.';

alter table public.times_class_newsletter enable row level security;

grant select on table public.times_class_newsletter to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policy
    where polrelid = 'public.times_class_newsletter'::regclass
      and polname = 'times_class_newsletter_read'
  ) then
    create policy times_class_newsletter_read
      on public.times_class_newsletter
      for select
      to authenticated
      using (true);
  end if;
end $$;

insert into public.times_class_newsletter (week_of, teacher, learning, reminders, upcoming)
values (
  '2026-10-06',
  'Mrs. Butler',
  '[
    {"subject":"Reading","text":"The moral of Big Al."},
    {"subject":"Writing","text":"Finishing the fruit writing, then a favorite-animal paragraph."},
    {"subject":"Math","text":"Two-digit addition strategies."},
    {"subject":"Phonics","text":"Consonant digraphs."},
    {"subject":"Science","text":"Wrapping up an engineering project, then what plants need to grow."}
  ]'::jsonb,
  '["Water bottle and morning snack daily.","Classroom Fridge photos welcome."]'::jsonb,
  '[
    {"date":"2026-10-16","text":"Webster County History Museum walking field trip (sack lunch)."},
    {"date":"2026-10-20","text":"Parent/Teacher Conferences, Oct. 20 and Oct. 22. Truman’s is Thu Oct. 22, 4:30 p.m."},
    {"date":"2026-10-27","text":"Red Ribbon Week, Oct. 27–30."},
    {"date":"2026-10-30","text":"Fall Party. Class party 1:30, costume walk at the track 2:30."}
  ]'::jsonb
)
on conflict (week_of) do nothing;
