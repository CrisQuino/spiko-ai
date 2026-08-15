-- The per-user JD cap applies to PERSONAL uploads only. Company-wide JDs
-- (uploaded by a manager / super-admin, visibility='company') bypass it and do
-- not count against anyone's personal cap.
CREATE OR REPLACE FUNCTION enforce_jd_cap() RETURNS trigger AS $$
DECLARE
  cnt integer;
  cap integer;
  comp_max integer;
  usr_plan text;
  usr_company uuid;
  free_max integer;
  prem_max integer;
BEGIN
  IF NEW.visibility = 'company' THEN RETURN NEW; END IF;
  SELECT count(*) INTO cnt FROM job_descriptions WHERE user_id = NEW.user_id AND visibility = 'personal';
  SELECT p.plan, p.company_id INTO usr_plan, usr_company FROM profiles p WHERE p.id = NEW.user_id;
  SELECT free_max_jds, premium_max_jds INTO free_max, prem_max FROM platform_settings WHERE id = 1;

  IF usr_company IS NOT NULL THEN
    SELECT max_jds_per_user INTO comp_max FROM companies WHERE id = usr_company;
    cap := COALESCE(comp_max, 2147483647);
  ELSIF usr_plan = 'premium' THEN
    cap := COALESCE(prem_max, 25);
  ELSE
    cap := COALESCE(free_max, 3);
  END IF;

  IF cnt >= cap THEN
    RAISE EXCEPTION 'JD_LIMIT: job description limit reached (%).', cap USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
