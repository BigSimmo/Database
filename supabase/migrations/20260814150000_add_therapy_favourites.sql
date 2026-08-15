alter table public.user_favourites
  drop constraint if exists user_favourites_content_type_check;

alter table public.user_favourites
  add constraint user_favourites_content_type_check
  check (content_type in ('service', 'form', 'differential', 'therapy'))
  not valid;
