-- ============================================================
-- Backfill artwork sugli item gia in archivio      (2026-09-19)
-- 32 lavori collegati. Ogni URL e stato verificato con HEAD -> 200.
-- Una sola UPDATE: o passa tutta o non passa niente.
-- Scrive solo dove image_url e ancora NULL (non tocca scelte gia fatte) e
-- lavora per external_id, quindi lo stesso titolo in piu gruppi e coperto.
-- Richiede la migration 2026-09-19_item_artwork.sql gia eseguita.
-- ============================================================

UPDATE public.media_items AS m
SET image_url = v.url
FROM (VALUES
    ('openlibrary:book:OL28938010W', 'https://covers.openlibrary.org/b/id/14428761-M.jpg'),
    ('openlibrary:book:OL37857698W', 'https://covers.openlibrary.org/b/id/14625533-M.jpg'),
    ('rawg:game:962011',             'https://media.rawg.io/media/resize/420/-/games/cca/ccaa933775fe1ffcebe40a01f52545db.jpg'),
    ('tmdb:movie:1027014',           'https://image.tmdb.org/t/p/w185/oMU3JpuKuasjAWIbUQgCaT6pco1.jpg'),
    ('tmdb:movie:11036',             'https://image.tmdb.org/t/p/w185/rNzQyW4f8B8cQeg7Dgj3n6eT5k9.jpg'),
    ('tmdb:movie:11104',             'https://image.tmdb.org/t/p/w185/43I9DcNoCzpyzK8JCkJYpHqHqGG.jpg'),
    ('tmdb:movie:11324',             'https://image.tmdb.org/t/p/w185/nrmXQ0zcZUL8jFLrakWc90IR8z9.jpg'),
    ('tmdb:movie:117',               'https://image.tmdb.org/t/p/w185/tPq0R4jTO4Ey8ZspFaWK9wGA4Ls.jpg'),
    ('tmdb:movie:11827',             'https://image.tmdb.org/t/p/w185/atUtWrDlLzT1yeVK2EoYtvbS963.jpg'),
    ('tmdb:movie:1244492',           'https://image.tmdb.org/t/p/w185/4f2EcNkp1Mvp9wE5w7HKxcmACWg.jpg'),
    ('tmdb:movie:13754',             'https://image.tmdb.org/t/p/w185/e2x1YDuZPpQiaQS25Ego7xMZYOI.jpg'),
    ('tmdb:movie:1375441',           'https://image.tmdb.org/t/p/w185/lmrulvLbmaejTix1YaMxo1oGhH1.jpg'),
    ('tmdb:movie:194662',            'https://image.tmdb.org/t/p/w185/rHUg2AuIuLSIYMYFgavVwqt1jtc.jpg'),
    ('tmdb:movie:21057',             'https://image.tmdb.org/t/p/w185/fSR1LLMIJZ6WcQEkM82yKy4F9vQ.jpg'),
    ('tmdb:movie:24238',             'https://image.tmdb.org/t/p/w185/ebmsM382m9IClLUzKYY2U5biFwM.jpg'),
    ('tmdb:movie:2567',              'https://image.tmdb.org/t/p/w185/lx4kWcZc3o9PaNxlQpEJZM17XUI.jpg'),
    ('tmdb:movie:291270',            'https://image.tmdb.org/t/p/w185/4DJ1zNr4Y6q7zQ27goEYla46VdO.jpg'),
    ('tmdb:movie:399174',            'https://image.tmdb.org/t/p/w185/4C7ZHv5LUPq7XzxC3nq8mBr77sP.jpg'),
    ('tmdb:movie:41201',             'https://image.tmdb.org/t/p/w185/Ac2tNYW9sRaOhmtMJQuhf2mvo00.jpg'),
    ('tmdb:movie:429200',            'https://image.tmdb.org/t/p/w185/yE1c9hj5Hf8a9KplAdRdhADqUro.jpg'),
    ('tmdb:movie:466420',            'https://image.tmdb.org/t/p/w185/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg'),
    ('tmdb:movie:5156',              'https://image.tmdb.org/t/p/w185/iPdVqIpmR3bRvOQJPrn4pr2KR3q.jpg'),
    ('tmdb:movie:57564',             'https://image.tmdb.org/t/p/w185/eVNOoFSpRnaCNSJwerAD0KkeibD.jpg'),
    ('tmdb:movie:666277',            'https://image.tmdb.org/t/p/w185/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg'),
    ('tmdb:movie:670',               'https://image.tmdb.org/t/p/w185/pWDtjs568ZfOTMbURQBYuT4Qxka.jpg'),
    ('tmdb:movie:823',               'https://image.tmdb.org/t/p/w185/63EMBxmcafkc4cWuUWQh2Ttd2jh.jpg'),
    ('tmdb:movie:97367',             'https://image.tmdb.org/t/p/w185/vY5j2xQzMGWmxBuhQo0HfA4Lxqb.jpg'),
    ('tmdb:movie:995133',            'https://image.tmdb.org/t/p/w185/wAKBWRhMmBtrCCuqmFwPm2RGTph.jpg'),
    ('tmdb:tv:1097',                 'https://image.tmdb.org/t/p/w185/tHcce6PKnhNBneSMbadI4jynHpY.jpg'),
    ('tmdb:tv:125909',               'https://image.tmdb.org/t/p/w185/zCHmmoqtLsIsou866osiWtIWmoA.jpg'),
    ('tmdb:tv:204154',               'https://image.tmdb.org/t/p/w185/bFlVZV8TQbs8hcIY7PVYonYFMgK.jpg'),
    ('tmdb:tv:95350',                'https://image.tmdb.org/t/p/w185/gpC7h43xPMEV3goYMQShfJbTtLq.jpg')
) AS v(external_id, url)
WHERE m.external_id = v.external_id
  AND m.image_url IS NULL;
