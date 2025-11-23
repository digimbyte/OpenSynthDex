# Weapon ID System Reference

## ID Range Categories

- **000**: Reserved (lost/missing number - special use)
- **001-099**: Melee weapons
- **101-199**: Pistols
- **201-299**: Compact/SMG/PDW
- **301-399**: Assault Rifles
- **401-499**: Snipers/DMR
- **501-599**: Shotguns
- **601-699**: Special (LMG/SAW)
- **701-799**: Rockets/Explosives
- **801-899**: Energy/Beam weapons
- **901-999**: Reserved for future generic categories
- **1001+**: Faction-specific weapons

---

## Generic Weapons (weapons_generic.json)

### Melee (001-099)
- 1: Arcline Shock Baton
- 2: Riotweave Flex-Taser
- 3: Sentinel Breach Hammer
- 4: Ironstar Duty Knife
- 5: Ghostline Conceal-Dagger
- 6: Helios Arc-Cutter
- 7: Cascade Shock-Cleaver
- 8: Voltline Phase-Edge
- 9: Bastion Entrench Spade
- 10: Strix Hand-Sabre
- 11: Ward Pulse-Tonfa
- 12: Kestrel Pry-Bar

### Pistols (101-199)
- 101: Sentinel-9 Service Pistol
- 102: Strix-45 Compact
- 103: Ironstar .44
- 104: Arcline Taser Pistol
- 105: Warden-19 Machine Pistol
- 106: Nomad-10 PDW Pistol
- 107: Medica-7 Injector
- 108: Voltline-22 EMP Pistol

### Compact/SMG/PDW (201-299)
- 201: Kestrel PD-4
- 202: Hailstorm-9
- 203: Streetline Mk.3
- 204: Whisper-M7
- 205: Tempest-11 Hybrid
- 206: Riotweave SMG
- 207: Ranger-S PDW
- 208: Ghostline Micro-SMG

### Assault Rifles (301-399)
- 301: Cobalt-556 Carbine
- 302: Hydra-73 Modular AR
- 303: Bastion-762
- 304: Fluxline G3 Caseless
- 305: Patrol-5 Carbine
- 306: Urbanite-300 "Shorty"
- 307: Sentinel-AR "Linewatch"
- 308: Cascade-545

### Snipers/DMR (401-499)
- 401: Longview-10
- 402: Marksman-12 "Spire"
- 403: Harrow-308
- 404: Ridge-20 Scout Rifle
- 405: Bastion-D "Designate"
- 406: Linebreaker-35
- 407: Vantage-21
- 408: Skystepper Mk.II
- 409: Needle SR-1
- 410: Lancer AMR-50
- 411: Whisperline S2
- 412: Prism-14
- 413: Longhook 338
- 414: Ghostline-X (Generic)
- 415: Spine-27
- 416: Surveyor-09

### Shotguns (501-599)
- 501: Brick-12 Pump
- 502: Scatter-8 Auto
- 503: Thundercone-10
- 504: StreetSaw-6
- 505: Breacher-90 Bullpup
- 506: Hammerfall-4 Slug Gun
- 507: Cloudburst Foamgun
- 508: Emberflare-12 Incendiary

### Special - LMG/SAW (601-699)
- 601: Rampart-249
- 602: Maelstrom-762
- 603: Cycler-X Rotary
- 604: Outpost-98
- 605: Bastion-L Support
- 606: Highway-73
- 607: Hailbarrel-66
- 608: Sentinel-SAW
- 609: Pyrethrower-6

### Rockets/Explosives (701-799)
- 701: RGL-40 Grenade Launcher
- 702: Raptor RPG-7N
- 703: Strix ML-3 Micromissile

### Energy/Beam (801-899)
- 801: ArcStorm Tesla Rifle

---

## Faction Weapons (weapons_faction.json)

### Faction Weapons (1001+)
- 1001: Vektor-9 Magistrate (Pistol)
- 1002: AR-99 TaseLine (Rifle)
- 1003: Civic Lance (Heavy)
- 1004: Gavel Purger (Pistol)
- 1005: Inquest-7 (Rifle)
- 1006: Black Sun (Heavy)
- 1007: Houndjaw (Pistol)
- 1008: Reaver's Coil (Rifle)
- 1009: Spinal Tap (Heavy)
- 1010: Ledger Taggun (Pistol)
- 1011: Tallyhook (Rifle)
- 1012: Charon Rig (Heavy)
- 1013: Gleamfang (Pistol)
- 1014: Tremorgut (Rifle)
- 1015: Choir Maw (Heavy)
- 1016: Graftline (Pistol)
- 1017: SpliceCaster (Rifle)
- 1018: Menagerie Pod (Heavy)
- 1019: TruLight (Pistol)
- 1020: Wardnet (Rifle)
- 1021: Aegis Halo (Heavy)
- 1022: Matchstick (Pistol)
- 1023: Grail-31 (Rifle)
- 1024: Mesh Uplink (Heavy)
- 1025: Drifter (Pistol)
- 1026: Roadbreaker (Rifle)
- 1027: Wartrain Pod (Heavy)
- 1028: Deposition (Pistol)
- 1029: Angleshot (Rifle)
- 1030: Edit Drone (Heavy)
- 1031: Chorus Seed (Pistol)
- 1032: Cantor Array (Rifle)
- 1033: Seraph Loom (Heavy)
- 1034: Determinant (Pistol)
- 1035: Vectorline (Rifle)
- 1036: Overcast Pulse (Heavy)
- 1037: Temperance (Pistol)
- 1038: Oathline (Rifle)
- 1039: Blackwall Pillar (Heavy)

---

## Notes

- Each category has space for 99 items (e.g., 1-99, 101-199, etc.)
- ID 000 is reserved for special use cases (missing weapons, placeholders, quest items)
- Generic weapons use ranges 1-899 (with 901-999 reserved for future generic categories)
- Faction-specific weapons start at 1001+ to clearly distinguish them from generic weapons
- You can organize faction weapons by hundreds too (1001-1099 for Faction A, 1101-1199 for Faction B, etc.)
