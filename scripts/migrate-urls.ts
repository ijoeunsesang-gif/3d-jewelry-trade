import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OLD_THUMB = 'https://fvhotaxjdacfulxjahon.supabase.co/storage/v1/object/public/thumbnails';
const NEW_THUMB = 'https://pub-5964134090c64788ac087efbbd252f4c.r2.dev';

async function migrate() {
  const { data: models, error } = await supabase.from('models').select('id, thumbnail');
  if (error) { console.error('Query error:', error); return; }
  console.log('Total models:', models.length);

  let count = 0;
  for (const model of models ?? []) {
    if (model.thumbnail?.startsWith(OLD_THUMB)) {
      const newUrl = model.thumbnail.replace(OLD_THUMB, NEW_THUMB);
      const { error: upErr } = await supabase
        .from('models')
        .update({ thumbnail: newUrl })
        .eq('id', model.id);
      if (upErr) {
        console.error('Update error:', model.id, upErr);
      } else {
        console.log('Updated:', model.id);
        console.log('  OLD:', model.thumbnail);
        console.log('  NEW:', newUrl);
        count++;
      }
    }
  }
  console.log(`Done. Updated ${count} / ${models.length} rows.`);
}
migrate();
