-- The transcript could come back with the answer before the question.
--
-- append_exchange() writes both rows in one statement pair, and `now()` in
-- Postgres is the transaction's start time, not the clock. Both rows therefore
-- carry the *identical* created_at, and conversation_history ordered by that
-- column alone, so the tie was broken by whatever the planner felt like. The
-- model could be handed its own reply and then the question that prompted it.
--
-- This passed twice before it failed, which is the only interesting thing about
-- it: an ordering bug with a 50% chance per run is a check that reports on luck.
--
-- The tie only ever happens inside one exchange, because separate exchanges are
-- separate transactions with different start times. Within an exchange the
-- question always precedes the answer, so ordering ties by role is not a
-- heuristic, it is the actual rule. `role = 'assistant'` sorts false before
-- true, which is user before assistant.

create or replace function public.conversation_history(
  p_conversation_id uuid,
  p_turns int default 6
)
returns table (role text, body text)
language sql
security definer
set search_path = public
stable
as $$
  select m.role, m.body
  from (
    select m.role, m.body, m.created_at
    from public.messages m
    where m.conversation_id = p_conversation_id
      and m.user_id = auth.uid()
    -- Descending, so the tiebreak descends too: within the newest exchange the
    -- answer is the newer row. Getting this backwards would drop the question
    -- and keep the answer whenever the limit cut through an exchange.
    order by m.created_at desc, (m.role = 'assistant') desc
    limit greatest(p_turns, 0)
  ) m
  order by m.created_at, (m.role = 'assistant');
$$;

revoke all on function public.conversation_history(uuid, int) from public;
grant execute on function public.conversation_history(uuid, int) to authenticated;

comment on function public.conversation_history(uuid, int) is
  'The last few turns of a conversation, oldest first, question before answer. '
  'Both rows of an exchange share a created_at because now() is the '
  'transaction time, so role breaks the tie.';
