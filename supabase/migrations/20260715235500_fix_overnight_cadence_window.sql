begin;

create or replace function public.cadence_next_allowed_at(
  base_at timestamptz,
  target_timezone text,
  allowed_days smallint[],
  start_time time,
  end_time time
)
returns timestamptz
language plpgsql
stable
as $$
declare
  base_local timestamp := base_at at time zone target_timezone;
  window_start_at timestamp;
  window_end_at timestamp;
  candidate_at timestamp;
  day_offset integer;
begin
  if coalesce(array_length(allowed_days, 1), 0) = 0 then
    raise exception 'Cadence must have at least one allowed weekday';
  end if;

  -- Include the previous local day. An overnight window belongs to the day
  -- on which it starts, but may still be open after midnight on the next day.
  for day_offset in -1..14 loop
    window_start_at := date_trunc('day', base_local) + day_offset * interval '1 day' + start_time;
    window_end_at := date_trunc('day', base_local) + day_offset * interval '1 day' + end_time;
    if end_time < start_time then
      window_end_at := window_end_at + interval '1 day';
    end if;

    if extract(dow from window_start_at)::smallint = any(allowed_days) then
      candidate_at := greatest(base_local, window_start_at);
      if candidate_at <= window_end_at then
        return candidate_at at time zone target_timezone;
      end if;
    end if;
  end loop;

  raise exception 'No allowed cadence window found';
end;
$$;

commit;
