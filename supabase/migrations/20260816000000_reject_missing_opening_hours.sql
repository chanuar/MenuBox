-- Missing opening-hours payloads must fail validation instead of propagating
-- SQL NULL through the scraper RPC's boolean guard.

create or replace function food.food_valid_opening_hours(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_entry jsonb;
  v_period jsonb;
  v_day integer;
  v_days integer[] := array[]::integer[];
begin
  if p_value is null
    or jsonb_typeof(p_value) <> 'array'
    or jsonb_array_length(p_value) > 7 then
    return false;
  end if;

  for v_entry in select value from jsonb_array_elements(p_value)
  loop
    if jsonb_typeof(v_entry) <> 'object'
      or not (v_entry ? 'day')
      or not (v_entry ? 'periods')
      or jsonb_typeof(v_entry->'periods') <> 'array'
      or jsonb_array_length(v_entry->'periods') > 4 then
      return false;
    end if;

    v_day := (v_entry->>'day')::integer;
    if v_day not between 1 and 7 or v_day = any(v_days) then return false; end if;
    v_days := array_append(v_days, v_day);

    for v_period in select value from jsonb_array_elements(v_entry->'periods')
    loop
      if jsonb_typeof(v_period) <> 'object'
        or coalesce(v_period->>'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(v_period->>'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_period->>'open' = v_period->>'close' then
        return false;
      end if;
    end loop;
  end loop;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then
  return false;
end;
$$;
