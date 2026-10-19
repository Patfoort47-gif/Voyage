// Aucune création d’espace n’est permise via l’API publique : seul ce script SQL initialise une ligne.
export const cloudSchema = String.raw`
create table if not exists public.voyage_spaces (
 id uuid primary key,
 read_hash text not null check (length(read_hash)=64),
 write_hash text not null check (length(write_hash)=64),
 payload jsonb,
 revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
alter table public.voyage_spaces enable row level security;
revoke all on public.voyage_spaces from public, anon, authenticated;

create or replace function public.voyage_read(p_id uuid, p_token text, p_revision bigint default -1)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare result jsonb;
begin
 if length(p_token) <> 43 then raise insufficient_privilege; end if;
 select jsonb_build_object('revision',revision,'payload',case when revision=p_revision then null else payload end,'unchanged',revision=p_revision) into result
 from public.voyage_spaces where id=p_id and read_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if result is null then raise insufficient_privilege; end if;
 return result;
end; $$;

create or replace function public.voyage_write(p_id uuid, p_token text, p_expected bigint, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare next_revision bigint;
begin
 if length(p_token) <> 43 then raise insufficient_privilege; end if;
 if p_payload is null or jsonb_typeof(p_payload) <> 'object'
 or (p_payload->>'v') is distinct from '1'
 or (p_payload->>'iv') is null or length(p_payload->>'iv') <> 16
 or (p_payload->>'data') is null or length(p_payload->>'data') > 18000000
 then raise exception 'Payload invalide'; end if;
 update public.voyage_spaces set payload=p_payload,revision=revision+1,updated_at=now()
 where id=p_id and write_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revision=p_expected
 returning revision into next_revision;
 if next_revision is not null then return jsonb_build_object('revision',next_revision); end if;
 if exists(select 1 from public.voyage_spaces where id=p_id and write_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex'))
 then return jsonb_build_object('conflict',true); end if;
 raise insufficient_privilege;
end; $$;
revoke all on function public.voyage_read(uuid,text,bigint) from public;
revoke all on function public.voyage_write(uuid,text,bigint,jsonb) from public;
grant execute on function public.voyage_read(uuid,text,bigint) to anon, authenticated;
grant execute on function public.voyage_write(uuid,text,bigint,jsonb) to anon, authenticated;
`;
export async function setupSQL(config, hash) {
  return (
    cloudSchema +
    `\ninsert into public.voyage_spaces(id,read_hash,write_hash) values ('${config.id}','${await hash(config.readToken)}','${await hash(config.writeToken)}') on conflict (id) do nothing;\n`
  );
}
