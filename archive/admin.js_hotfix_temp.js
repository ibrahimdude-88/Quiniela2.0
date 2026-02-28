
// --- HOTFIX: Revert DemonSlayer ---
(async function fixPlayoffName() {
    console.log('[HOTFIX] Reverting DemonSlayer to UEFA4...');
    try {
        await supabase.from('matches').update({ home_team: 'UEFA4' }).eq('home_team', 'DemonSlayer');
        await supabase.from('matches').update({ away_team: 'UEFA4' }).eq('away_team', 'DemonSlayer');

        // Fix mapping if exists
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'playoff_mapping').single();
        if (data && data.value) {
            data.value['UEFA4'] = 'UEFA4';
            await supabase.from('app_settings').upsert({ key: 'playoff_mapping', value: data.value });
            console.log('[HOTFIX] Mapping updated.');
        }
        console.log('[HOTFIX] Done.');
    } catch (e) {
        console.error('[HOTFIX] Error:', e);
    }
})();
