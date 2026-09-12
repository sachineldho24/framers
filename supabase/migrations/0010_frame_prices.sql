-- Approved base prices: A5 INR 300, A4 INR 500, A3 INR 1,000.
-- Existing orders retain their original amount; style/finish modifiers still apply.
update public.frames
set price_paise = case slug
  when 'a5-frame' then 30000
  when 'a4-frame' then 50000
  when 'a3-frame' then 100000
end
where slug in ('a5-frame', 'a4-frame', 'a3-frame');
