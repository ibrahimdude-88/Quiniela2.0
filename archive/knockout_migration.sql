-- Add penalty_winner columns
ALTER TABLE matches ADD COLUMN penalty_winner varchar(10) CHECK (penalty_winner IN ('home', 'away'));
ALTER TABLE predictions ADD COLUMN penalty_winner varchar(10) CHECK (penalty_winner IN ('home', 'away'));

-- Update calculation logic
CREATE OR REPLACE FUNCTION calculate_points_for_match(match_row matches)
RETURNS void AS $$
DECLARE
  pred record;
  points int;
  match_winner_sign int; -- 1 home, -1 away, 0 draw
  pred_winner_sign int;
  real_outcome varchar; -- 'home', 'away', 'draw' (only if no penalties)
  pred_outcome varchar; 
BEGIN
  -- Determine Match Winner (Real)
  IF match_row.home_score > match_row.away_score THEN
    match_winner_sign := 1;
  ELSIF match_row.home_score < match_row.away_score THEN
    match_winner_sign := -1;
  ELSE
    -- Draw in regular time or extra time
    IF match_row.penalty_winner = 'home' THEN
      match_winner_sign := 1;
    ELSIF match_row.penalty_winner = 'away' THEN
      match_winner_sign := -1;
    ELSE
      match_winner_sign := 0; -- Should not happen in knockout if tied
    END IF;
  END IF;

  FOR pred IN SELECT * FROM predictions WHERE match_id = match_row.id LOOP
    points := 0;
    
    -- Check for valid prediction
    IF pred.home_score IS NOT NULL AND pred.away_score IS NOT NULL THEN
      
      -- Determine Prediction Winner
      IF pred.home_score > pred.away_score THEN
        pred_winner_sign := 1;
      ELSIF pred.home_score < pred.away_score THEN
        pred_winner_sign := -1;
      ELSE
        -- Draw predicted
        IF pred.penalty_winner = 'home' THEN
          pred_winner_sign := 1;
        ELSIF pred.penalty_winner = 'away' THEN
          pred_winner_sign := -1;
        ELSE
           -- User predicted draw but didn't pick penalty winner? Treat as Draw (0)
           -- In knockout, this is technically a wrong prediction if match requires winner
           pred_winner_sign := 0;
        END IF;
      END IF;

      -- 1. Check Winner (+3 Points)
      -- If raw signs match, or if it was a draw and penalties decided it
      IF pred_winner_sign = match_winner_sign AND match_winner_sign != 0 THEN
        points := points + 3;
      ELSIF match_winner_sign = 0 AND pred_winner_sign = 0 THEN
         -- Group stage draw, both predicted draw
         points := points + 3;
      END IF;

      -- 2. Check Exact Score (+5 Points)
      IF pred.home_score = match_row.home_score AND pred.away_score = match_row.away_score THEN
        -- If it's a draw, we ALSO need the penalty winner to match to get full points
        IF match_row.home_score = match_row.away_score THEN
           IF match_row.penalty_winner IS NOT DISTINCT FROM pred.penalty_winner THEN
              points := points + 5;
           END IF;
        ELSE
           -- Not a draw, simple exact score
           points := points + 5;
        END IF;
      END IF;
      
    END IF;

    -- Update prediction
    UPDATE predictions SET points_earned = points WHERE id = pred.id;
  END LOOP;
  
  -- Update profiles for all affected users
  -- (Optimization: could do this in bulk outside loop, but for 50-100 users this is fine)
  UPDATE profiles 
  SET points = (SELECT coalesce(sum(points_earned), 0) FROM predictions WHERE user_id = profiles.id)
  WHERE id IN (SELECT user_id FROM predictions WHERE match_id = match_row.id);
  
END;
$$ LANGUAGE plpgsql;


-- Insert Knockout Matches (Placeholders)
-- 16vos (Round of 32): Matchday 4. IDs 73-88.
INSERT INTO matches (matchday, home_team, away_team, date, status, group_name) VALUES
(4, 'TBD', 'TBD', '2026-06-28 12:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-06-28 15:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-06-28 18:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-06-29 12:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-06-29 15:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-06-29 18:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-06-30 12:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-06-30 15:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-06-30 18:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-07-01 12:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-07-01 15:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-07-01 18:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-07-02 12:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-07-02 15:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-07-02 18:00:00+00', 's', '16vos'),
(4, 'TBD', 'TBD', '2026-07-03 12:00:00+00', 's', '16vos');

-- 8vos (Round of 16): Matchday 5.
INSERT INTO matches (matchday, home_team, away_team, date, status, group_name) VALUES
(5, 'TBD', 'TBD', '2026-07-04 12:00:00+00', 's', '8vos'),
(5, 'TBD', 'TBD', '2026-07-04 16:00:00+00', 's', '8vos'),
(5, 'TBD', 'TBD', '2026-07-05 12:00:00+00', 's', '8vos'),
(5, 'TBD', 'TBD', '2026-07-05 16:00:00+00', 's', '8vos'),
(5, 'TBD', 'TBD', '2026-07-06 12:00:00+00', 's', '8vos'),
(5, 'TBD', 'TBD', '2026-07-06 16:00:00+00', 's', '8vos'),
(5, 'TBD', 'TBD', '2026-07-07 12:00:00+00', 's', '8vos'),
(5, 'TBD', 'TBD', '2026-07-07 16:00:00+00', 's', '8vos');

-- 4tos: Matchday 6.
INSERT INTO matches (matchday, home_team, away_team, date, status, group_name) VALUES
(6, 'TBD', 'TBD', '2026-07-09 12:00:00+00', 's', '4tos'),
(6, 'TBD', 'TBD', '2026-07-09 16:00:00+00', 's', '4tos'),
(6, 'TBD', 'TBD', '2026-07-10 12:00:00+00', 's', '4tos'),
(6, 'TBD', 'TBD', '2026-07-10 16:00:00+00', 's', '4tos');

-- Semi: Matchday 7.
INSERT INTO matches (matchday, home_team, away_team, date, status, group_name) VALUES
(7, 'TBD', 'TBD', '2026-07-14 14:00:00+00', 's', 'Semi'),
(7, 'TBD', 'TBD', '2026-07-15 14:00:00+00', 's', 'Semi');

-- Finals: Matchday 8.
INSERT INTO matches (matchday, home_team, away_team, date, status, group_name) VALUES
(8, 'TBD', 'TBD', '2026-07-18 14:00:00+00', 's', '3ro'), -- 3rd Place
(8, 'TBD', 'TBD', '2026-07-19 14:00:00+00', 's', 'Final'); -- Final
