-- Official athletics headshots for Thompson Times Favorite Coaches.
-- Only sharp studio portraits are stored. A missing URL is omitted in print.

alter table public.times_coach_profiles
  add column if not exists headshot_url text,
  add column if not exists headshot_source_url text,
  add column if not exists headshot_source_label text,
  add column if not exists headshot_as_of date;

comment on column public.times_coach_profiles.headshot_url is
  'Official athletics or ESPN coach portrait. Omit rather than store a thumbnail.';

update public.times_coach_profiles set
  headshot_url = 'https://mutigers.com/imgproxy/I-bojnY2D0c-kesAsBS4TBFX9ytMGSfukMIvmNiVwIk/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL211dGlnZXJzLWNvbS1wcm9kLzIwMjYvMDYvMTcvZmpCVVJFQkNNWVRLa1RmOEx0MWhQRDFVNWxtdnVUUU5ES3RmY0lNRi5qcGc.jpg',
  headshot_source_url = 'https://mutigers.com/sports/football/roster/season/2026/staff/eli-drinkwitz',
  headshot_source_label = 'Mizzou Athletics, 2026',
  headshot_as_of = '2026-06-17',
  updated_at = now()
where coach_id = '4409388';

update public.times_coach_profiles set
  headshot_url = 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/usctrojans.com/images/2025/3/19/Lincoln_Riley_Headshot.jpg',
  headshot_source_url = 'https://usctrojans.com/sports/football/roster/coaches/lincoln-riley/7394',
  headshot_source_label = 'USC Athletics, 2025',
  headshot_as_of = '2025-03-19',
  updated_at = now()
where coach_id = '145698';

update public.times_coach_profiles set
  headshot_url = 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/cubuffs.com/images/2022/12/4/Prime_Headshot.jpg',
  headshot_source_url = 'https://cubuffs.com/sports/football/roster/coaches/deion-coach-prime-sanders/4683',
  headshot_source_label = 'Colorado Athletics, 2022',
  headshot_as_of = '2022-12-04',
  updated_at = now()
where coach_id = '560112';

update public.times_coach_profiles set
  headshot_url = 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/unc.sidearmsports.com/images/2024/12/12/Belichick_Bill.fb.16.jpg',
  headshot_source_url = 'https://goheels.com/sports/football/roster/coaches/bill-belichick/4644',
  headshot_source_label = 'UNC Athletics, 2024',
  headshot_as_of = '2024-12-12',
  updated_at = now()
where coach_id = '560247';

update public.times_coach_profiles set
  headshot_url = 'https://auburntigers.com/imgproxy/Ds26RITntYYgOkzwdSc2bjnlScxc8juxb2bZQUpHC98/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2F1YnVybi1wcm9kLzIwMjUvMTIvMDEvcmNEczFGQVI4M1VvSkVjY2NoMVh3MUZ1aGF3UHhDOFFDMmNsOVpoZC5qcGc.jpg',
  headshot_source_url = 'https://auburntigers.com/sports/football/roster/season/2026/staff/alex-golesh',
  headshot_source_label = 'Auburn Athletics, 2025',
  headshot_as_of = '2025-12-01',
  updated_at = now()
where coach_id = '5120149';
