-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- PROFILES TABLE (Linked to Auth)
create table profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  username text unique,
  whatsapp text,
  role text default 'user' check (role in ('user', 'admin')),
  paid boolean default false,
  points int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- MATCHES TABLE
create table matches (
  id serial primary key,
  date timestamp with time zone not null,
  group_name varchar(10),
  home_team varchar(50) not null,
  away_team varchar(50) not null,
  home_score int,
  away_score int,
  stadium varchar(100),
  matchday int not null,
  status varchar(1) default 'a' check (status in ('b', 'a', 'f')) -- b: blocked, a: open, f: finalized
);

-- PREDICTIONS TABLE
create table predictions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) not null,
  match_id int references matches(id) not null,
  home_score int,
  away_score int,
  points_earned int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, match_id)
);

-- ROW LEVEL SECURITY (RLS)
alter table profiles enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;

-- POLICIES FOR PROFILES
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- POLICIES FOR MATCHES
create policy "Matches are viewable by everyone"
  on matches for select
  using ( true );

create policy "Admins can insert matches"
  on matches for insert
  with check ( exists ( select 1 from profiles where id = auth.uid() and role = 'admin' ) );

create policy "Admins can update matches"
  on matches for update
  using ( exists ( select 1 from profiles where id = auth.uid() and role = 'admin' ) );

-- POLICIES FOR PREDICTIONS
create policy "Users can insert own predictions"
  on predictions for insert
  with check ( auth.uid() = user_id );

create policy "Users can see their own predictions always"
  on predictions for select
  using ( auth.uid() = user_id );

create policy "Users can see others predictions only if match is locked or finalized"
  on predictions for select
  using (
    exists (
      select 1 from matches
      where matches.id = predictions.match_id
      and (matches.status = 'b' or matches.status = 'f')
    )
  );

create policy "Users can update own predictions if match is open"
  on predictions for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from matches
      where matches.id = predictions.match_id
      and matches.status = 'a'
    )
  );

-- TRIGGER FOR NEW USERS
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, username, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', 'user');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- FUNCTION TO CALCULATE POINTS (To be called from App or via Trigger on Match Update)
create or replace function calculate_points_for_match(match_row matches)
returns void as $$
declare
  pred record;
  points int;
  is_exact boolean;
  is_winner boolean;
  match_winner_sign int; -- 1 home, -1 away, 0 draw
  pred_winner_sign int;
begin
  -- Determine match winner sign
  if match_row.home_score > match_row.away_score then
    match_winner_sign := 1;
  elsif match_row.home_score < match_row.away_score then
    match_winner_sign := -1;
  else
    match_winner_sign := 0;
  end if;

  for pred in select * from predictions where match_id = match_row.id loop
    points := 0;
    
    -- Check for valid prediction (0 is valid, null is not)
    if pred.home_score is not null and pred.away_score is not null then
      
      -- Exact match (+5 + 3 = 8 points) or just +5?
      -- Prompt says: Total Possible 8. Exact (+5). Winner (+3).
      -- Usually "Exact" implies you also got the winner right.
      -- So if Exact: 5 (exact) + 3 (winner) = 8? Or is Exact 5 total?
      -- Prompt: "Acierto Exacto (+5): Coincidencia total. Acierto de Ganador (+3): Coincidencia en el desenlace".
      -- Interpretation: Points are cumulative or separate categories?
      -- "Total Posible per Partido: 8 Puntos."
      -- This implies 5 + 3 = 8.
      
      -- Check Winner
      if pred.home_score > pred.away_score then
        pred_winner_sign := 1;
      elsif pred.home_score < pred.away_score then
        pred_winner_sign := -1;
      else
        pred_winner_sign := 0;
      end if;

      if pred_winner_sign = match_winner_sign then
        points := points + 3;
      end if;

      -- Check Exact Score
      if pred.home_score = match_row.home_score and pred.away_score = match_row.away_score then
        points := points + 5;
      end if;
      
    end if;

    -- Update prediction points
    update predictions set points_earned = points where id = pred.id;
    
    -- Update user total points
    -- We can do this by recalculating sum of all predictions for the user
    update profiles 
    set points = (select coalesce(sum(points_earned), 0) from predictions where user_id = pred.user_id)
    where id = pred.user_id;
    
  end loop;
end;
$$ language plpgsql;

-- TRIGGER TO RECALCULATE POINTS ON MATCH FINALIZE
create or replace function on_match_update()
returns trigger as $$
begin
  -- Only calculate if status changed to 'f' or score changed while 'f'
  if (new.status = 'f' and (old.status != 'f' or new.home_score != old.home_score or new.away_score != old.away_score)) then
    perform calculate_points_for_match(new);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_match_update
  after update on matches
  for each row execute procedure on_match_update();

-- SEED DATA
INSERT INTO matches (id, date, group_name, home_team, away_team, stadium, matchday) VALUES
-- JORNADA 1
(1, '2026-06-11 13:00:00-06', 'A', 'MEX', 'RSA', 'Estadio Azteca, CDMX', 1),
(2, '2026-06-11 20:00:00-06', 'A', 'KOR', 'UEFA4', 'Estadio Akron, Guadalajara', 1),
(3, '2026-06-12 15:00:00-04', 'B', 'CAN', 'UEFA1', 'BMO Field, Toronto', 1),
(4, '2026-06-12 18:00:00-07', 'D', 'USA', 'PAR', 'SoFi Stadium, Los Angeles', 1),
(5, '2026-06-13 18:00:00-04', 'C', 'BRA', 'MAR', 'MetLife Stadium, NY/NJ', 1),
(6, '2026-06-13 15:00:00-04', 'C', 'HAI', 'SCO', 'Gillette Stadium, Boston', 1),
(7, '2026-06-13 13:00:00-07', 'B', 'QAT', 'SUI', 'Levi''s Stadium, San Francisco', 1),
(8, '2026-06-13 19:00:00-07', 'D', 'AUS', 'UEFA3', 'BC Place, Vancouver', 1),
(9, '2026-06-14 12:00:00-05', 'E', 'GER', 'CUR', 'NRG Stadium, Houston', 1),
(10, '2026-06-14 15:00:00-05', 'F', 'NED', 'JPN', 'AT&T Stadium, Dallas', 1),
(11, '2026-06-14 18:00:00-04', 'E', 'CIV', 'ECU', 'Lincoln Financial Field, Philadelphia', 1),
(12, '2026-06-14 20:00:00-06', 'F', 'UEFA2', 'TUN', 'Estadio BBVA, Monterrey', 1),
(13, '2026-06-15 12:00:00-04', 'H', 'ESP', 'CPV', 'Mercedes-Benz Stadium, Atlanta', 1),
(14, '2026-06-15 15:00:00-04', 'H', 'KSA', 'URU', 'Hard Rock Stadium, Miami', 1),
(15, '2026-06-15 13:00:00-07', 'G', 'BEL', 'EGY', 'Lumen Field, Seattle', 1),
(16, '2026-06-15 18:00:00-07', 'G', 'IRN', 'NZL', 'SoFi Stadium, Los Angeles', 1),
(17, '2026-06-16 15:00:00-04', 'I', 'FRA', 'SEN', 'MetLife Stadium, NY/NJ', 1),
(18, '2026-06-16 18:00:00-04', 'I', 'IC2', 'NOR', 'Gillette Stadium, Boston', 1),
(19, '2026-06-16 14:00:00-05', 'J', 'ARG', 'ALG', 'Arrowhead Stadium, Kansas City', 1),
(20, '2026-06-16 18:00:00-07', 'J', 'AUT', 'JOR', 'Levi''s Stadium, San Francisco', 1),
(21, '2026-06-17 12:00:00-05', 'L', 'ENG', 'CRO', 'AT&T Stadium, Dallas', 1),
(22, '2026-06-17 15:00:00-05', 'K', 'POR', 'IC1', 'NRG Stadium, Houston', 1),
(23, '2026-06-17 19:00:00-06', 'K', 'UZB', 'COL', 'Estadio Azteca, CDMX', 1),
(24, '2026-06-17 19:00:00-04', 'L', 'GHA', 'PAN', 'BMO Field, Toronto', 1),
-- JORNADA 2
(25, '2026-06-18 20:00:00-06', 'A', 'MEX', 'KOR', 'Estadio Akron, Guadalajara', 2),
(26, '2026-06-18 13:00:00-05', 'A', 'UEFA4', 'RSA', 'Mercedes-Benz Stadium, Atlanta', 2),
(27, '2026-06-18 16:00:00-07', 'B', 'CAN', 'QAT', 'BC Place, Vancouver', 2),
(28, '2026-06-18 19:00:00-07', 'B', 'SUI', 'UEFA1', 'SoFi Stadium, Los Angeles', 2),
(29, '2026-06-19 18:00:00-07', 'D', 'USA', 'AUS', 'Lumen Field, Seattle', 2),
(30, '2026-06-19 12:00:00-04', 'D', 'UEFA3', 'PAR', 'Lincoln Financial Field, Philadelphia', 2),
(31, '2026-06-19 15:00:00-04', 'C', 'BRA', 'HAI', 'Gillette Stadium, Boston', 2),
(32, '2026-06-19 21:00:00-07', 'C', 'SCO', 'MAR', 'Levi''s Stadium, San Francisco', 2),
(33, '2026-06-20 16:00:00-04', 'E', 'GER', 'CIV', 'BMO Field, Toronto', 2),
(34, '2026-06-20 13:00:00-05', 'E', 'ECU', 'CUR', 'NRG Stadium, Houston', 2),
(35, '2026-06-20 19:00:00-06', 'F', 'NED', 'UEFA2', 'Estadio BBVA, Monterrey', 2),
(36, '2026-06-20 21:00:00-07', 'F', 'TUN', 'JPN', 'Lumen Field, Seattle', 2),
(37, '2026-06-21 12:00:00-04', 'H', 'ESP', 'KSA', 'Mercedes-Benz Stadium, Atlanta', 2),
(38, '2026-06-21 18:00:00-04', 'H', 'URU', 'CPV', 'Hard Rock Stadium, Miami', 2),
(39, '2026-06-21 15:00:00-05', 'G', 'BEL', 'IRN', 'Arrowhead Stadium, Kansas City', 2),
(40, '2026-06-21 19:00:00-07', 'G', 'NZL', 'EGY', 'SoFi Stadium, Los Angeles', 2),
(41, '2026-06-22 15:00:00-04', 'J', 'ARG', 'AUT', 'MetLife Stadium, NY/NJ', 2),
(42, '2026-06-22 18:00:00-05', 'J', 'JOR', 'ALG', 'AT&T Stadium, Dallas', 2),
(43, '2026-06-22 12:00:00-05', 'I', 'FRA', 'IC2', 'NRG Stadium, Houston', 2),
(44, '2026-06-22 21:00:00-07', 'I', 'NOR', 'SEN', 'BC Place, Vancouver', 2),
(45, '2026-06-23 15:00:00-04', 'L', 'ENG', 'GHA', 'Gillette Stadium, Boston', 2),
(46, '2026-06-23 18:00:00-04', 'L', 'PAN', 'CRO', 'BMO Field, Toronto', 2),
(47, '2026-06-23 21:00:00-06', 'K', 'POR', 'UZB', 'Estadio Azteca, CDMX', 2),
(48, '2026-06-23 12:00:00-04', 'K', 'COL', 'IC1', 'Hard Rock Stadium, Miami', 2),
-- JORNADA 3
(49, '2026-06-24 19:00:00-06', 'A', 'MEX', 'UEFA4', 'Estadio Azteca, CDMX', 3),
(50, '2026-06-24 21:00:00-06', 'A', 'RSA', 'KOR', 'Estadio BBVA, Monterrey', 3),
(51, '2026-06-24 16:00:00-07', 'B', 'CAN', 'SUI', 'BC Place, Vancouver', 3),
(52, '2026-06-24 18:00:00-07', 'B', 'QAT', 'UEFA1', 'Lumen Field, Seattle', 3),
(53, '2026-06-25 18:00:00-07', 'D', 'USA', 'UEFA3', 'SoFi Stadium, Los Angeles', 3),
(54, '2026-06-25 21:00:00-07', 'D', 'PAR', 'AUS', 'Levi''s Stadium, San Francisco', 3),
(55, '2026-06-25 15:00:00-04', 'C', 'BRA', 'SCO', 'Lincoln Financial Field, Philadelphia', 3),
(56, '2026-06-25 18:00:00-04', 'C', 'MAR', 'HAI', 'MetLife Stadium, NY/NJ', 3),
(57, '2026-06-26 15:00:00-05', 'E', 'GER', 'ECU', 'AT&T Stadium, Dallas', 3),
(58, '2026-06-26 12:00:00-05', 'E', 'CUR', 'CIV', 'NRG Stadium, Houston', 3),
(59, '2026-06-26 18:00:00-04', 'F', 'NED', 'TUN', 'Gillette Stadium, Boston', 3),
(60, '2026-06-26 21:00:00-07', 'F', 'JPN', 'UEFA2', 'BC Place, Vancouver', 3),
(61, '2026-06-26 15:00:00-04', 'H', 'ESP', 'URU', 'Hard Rock Stadium, Miami', 3),
(62, '2026-06-26 18:00:00-04', 'H', 'CPV', 'KSA', 'Mercedes-Benz Stadium, Atlanta', 3),
(63, '2026-06-26 13:00:00-07', 'G', 'BEL', 'NZL', 'Levi''s Stadium, San Francisco', 3),
(64, '2026-06-26 19:00:00-07', 'G', 'EGY', 'IRN', 'Lumen Field, Seattle', 3),
(65, '2026-06-27 14:00:00-05', 'J', 'ARG', 'JOR', 'Arrowhead Stadium, Kansas City', 3),
(66, '2026-06-27 17:00:00-05', 'J', 'ALG', 'AUT', 'AT&T Stadium, Dallas', 3),
(67, '2026-06-27 15:00:00-04', 'I', 'FRA', 'NOR', 'MetLife Stadium, NY/NJ', 3),
(68, '2026-06-27 18:00:00-04', 'I', 'SEN', 'IC2', 'Lincoln Financial Field, Philadelphia', 3),
(69, '2026-06-27 12:00:00-04', 'L', 'ENG', 'PAN', 'Gillette Stadium, Boston', 3),
(70, '2026-06-27 15:00:00-04', 'L', 'CRO', 'GHA', 'BMO Field, Toronto', 3),
(71, '2026-06-27 19:00:00-04', 'K', 'POR', 'COL', 'Hard Rock Stadium, Miami', 3),
(72, '2026-06-27 21:00:00-04', 'K', 'UZB', 'IC1', 'Mercedes-Benz Stadium, Atlanta', 3);

-- Reset sequence for matches incase it gets out of sync (optional but good practice)
SELECT setval('matches_id_seq', (SELECT MAX(id) FROM matches));
