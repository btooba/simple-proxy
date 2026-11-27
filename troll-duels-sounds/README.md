# Troll Duels — game sound effects

Made with earshot (github.com/Leonxlnx/earshot, MIT; every sound is computed, no recordings are shipped, free to use).
All files are .ogg, which Roblox accepts as Audio. Remake one with: `earshot make --sound <design> -o <name>.ogg`.

| File | When it plays | earshot design | Length |
|---|---|---|---|
| ui_click.ogg | any menu button | switch/push | 0.34 s |
| ui_select.ogg | moving between items in a menu | switch/small | 0.41 s |
| troll_pick.ogg | picking a troll before the fight | success/rise | 1.8 s |
| round_start.ogg | countdown beep (play 3 times, then a higher one) | countdown/beep | 0.36 s |
| screen_flip.ogg | a player's screen gets flipped | whoosh/spin | 2.6 s |
| banana_drop.ogg | a banana peel lands | thump/soft | 0.09 s |
| banana_slip.ogg | a player steps on the banana | jump/spring | 0.71 s |
| slide_off.ogg | sliding off the map / falling | fall/air | 1.9 s |
| bonk_1/2/3.ogg | a bonk hit (pick one at random so it never sounds the same) | slapstick/crack | 0.5 s |
| elixir_fill.ogg | elixir going up | magic/cast | 1.7 s |
| elixir_full.ogg | elixir full, the bomb is ready | power_up/rise | 2.8 s |
| bomb_explode.ogg | the bomb goes off | explosion/big | 2.9 s |
| launch.ogg | players flying through the air | whoosh/soft | 0.39 s |
| troll_laugh.ogg | after a successful troll | laugh/person | 1.8 s |
| win.ogg | winning a duel | win/fanfare | 2.9 s |
| lose.ogg | losing a duel | lose/descend | 3.4 s |
| coin.ogg | getting coins | coin/bright | 0.69 s |
| crate_open.ogg | opening the pet crate | chest/open | 1.4 s |
| pet_reveal.ogg | the pet appears (the OG pet reveal) | shine/sweep | 1.8 s |

Uploading to Roblox: Creator Hub > Creations > Audio > upload each file (or Studio > Asset Manager > Bulk Import),
then paste the asset ids into the game's Sound objects. Audio uploads are free, within Roblox's monthly upload limit.
