-- Fills the new detail columns for the seeded catalogue.
--
-- Figures are the widely published ones for each coaster, rounded to the
-- precision enthusiasts actually quote. They stand in for the RCDB integration
-- that v1 leaves out, so they are approximate by design — an admin can correct
-- any of them, and the real integration would overwrite them wholesale.
--
-- Coordinates are park-level, not per-coaster: a map link should drop you at the
-- gate, which is where you actually arrive.
-- Matched on (name, park), the same pair the unique index enforces.

update public.coasters as c
set height_m    = v.height_m,
    length_m    = v.length_m,
    speed_kmh   = v.speed_kmh,
    inversions  = v.inversions,
    opened_year = v.opened_year,
    park_city   = v.park_city,
    park_url    = v.park_url,
    latitude    = v.latitude,
    longitude   = v.longitude
from (values
  ('Nemesis','Alton Towers',13,716,80,4,1994,'Alton, Staffordshire','https://www.altontowers.com',52.987200,-1.892500),
  ('Oblivion','Alton Towers',20,373,109,0,1998,'Alton, Staffordshire','https://www.altontowers.com',52.987200,-1.892500),
  ('The Smiler','Alton Towers',30,1170,85,14,2013,'Alton, Staffordshire','https://www.altontowers.com',52.987200,-1.892500),
  ('Wicker Man','Alton Towers',22,683,70,0,2018,'Alton, Staffordshire','https://www.altontowers.com',52.987200,-1.892500),
  ('Stealth','Thorpe Park',62,400,128,0,2006,'Chertsey, Surrey','https://www.thorpepark.com',51.404500,-0.510700),
  ('The Swarm','Thorpe Park',39,775,100,5,2012,'Chertsey, Surrey','https://www.thorpepark.com',51.404500,-0.510700),
  ('Nemesis Inferno','Thorpe Park',29,715,88,4,2003,'Chertsey, Surrey','https://www.thorpepark.com',51.404500,-0.510700),
  ('Icon','Blackpool Pleasure Beach',27,1143,85,0,2018,'Blackpool, Lancashire','https://www.blackpoolpleasurebeach.com',53.790700,-3.055300),
  ('The Big One','Blackpool Pleasure Beach',65,1675,119,0,1994,'Blackpool, Lancashire','https://www.blackpoolpleasurebeach.com',53.790700,-3.055300),
  ('Infusion','Blackpool Pleasure Beach',32,690,80,5,2007,'Blackpool, Lancashire','https://www.blackpoolpleasurebeach.com',53.790700,-3.055300),
  ('Millennium Force','Cedar Point',94,2010,150,0,2000,'Sandusky, Ohio','https://www.cedarpoint.com',41.482200,-82.683600),
  ('Steel Vengeance','Cedar Point',62,1750,119,4,2018,'Sandusky, Ohio','https://www.cedarpoint.com',41.482200,-82.683600),
  ('Maverick','Cedar Point',32,1354,113,2,2007,'Sandusky, Ohio','https://www.cedarpoint.com',41.482200,-82.683600),
  ('Top Thrill 2','Cedar Point',128,1257,193,0,2024,'Sandusky, Ohio','https://www.cedarpoint.com',41.482200,-82.683600),
  ('Fury 325','Carowinds',99,2019,153,0,2015,'Charlotte, North Carolina','https://www.carowinds.com',35.104100,-80.939400),
  ('El Toro','Six Flags Great Adventure',55,1315,113,0,2006,'Jackson, New Jersey','https://www.sixflags.com/greatadventure',40.138100,-74.440000),
  ('Nitro','Six Flags Great Adventure',70,1618,128,0,2001,'Jackson, New Jersey','https://www.sixflags.com/greatadventure',40.138100,-74.440000),
  ('Kingda Ka','Six Flags Great Adventure',139,950,206,0,2005,'Jackson, New Jersey','https://www.sixflags.com/greatadventure',40.138100,-74.440000),
  ('The Voyage','Holiday World',50,1964,108,0,2006,'Santa Claus, Indiana','https://www.holidayworld.com',38.123300,-86.918600),
  ('Iron Gwazi','Busch Gardens Tampa Bay',63,1249,122,3,2022,'Tampa, Florida','https://buschgardens.com/tampa',28.037200,-82.419400),
  ('SheiKra','Busch Gardens Tampa Bay',61,975,113,1,2005,'Tampa, Florida','https://buschgardens.com/tampa',28.037200,-82.419400),
  ('Montu','Busch Gardens Tampa Bay',46,1200,97,7,1996,'Tampa, Florida','https://buschgardens.com/tampa',28.037200,-82.419400),
  ('VelociCoaster','Islands of Adventure',47,1433,113,4,2021,'Orlando, Florida','https://www.universalorlando.com',28.471800,-81.471300),
  ('Hagrid''s Magical Creatures Motorbike Adventure','Islands of Adventure',20,1585,80,0,2019,'Orlando, Florida','https://www.universalorlando.com',28.471800,-81.471300),
  ('X2','Six Flags Magic Mountain',53,1160,122,2,2002,'Valencia, California','https://www.sixflags.com/magicmountain',34.425300,-118.597100),
  ('Twisted Colossus','Six Flags Magic Mountain',37,1500,92,2,2015,'Valencia, California','https://www.sixflags.com/magicmountain',34.425300,-118.597100),
  ('Taron','Phantasialand',30,1525,117,0,2016,'Brühl','https://www.phantasialand.de',50.798600,6.879200),
  ('F.L.Y.','Phantasialand',28,1330,100,3,2020,'Brühl','https://www.phantasialand.de',50.798600,6.879200),
  ('Blue Fire','Europa-Park',38,1056,100,4,2009,'Rust','https://www.europapark.de',48.266000,7.722000),
  ('Silver Star','Europa-Park',73,1620,127,0,2002,'Rust','https://www.europapark.de',48.266000,7.722000),
  ('Voltron Nevera','Europa-Park',32,1385,90,7,2024,'Rust','https://www.europapark.de',48.266000,7.722000),
  ('Wodan Timbur Coaster','Europa-Park',40,1050,100,0,2012,'Rust','https://www.europapark.de',48.266000,7.722000),
  ('Schwur des Kaernan','Hansa-Park',73,1234,127,1,2015,'Sierksdorf','https://www.hansapark.de',54.114700,10.808300),
  ('Expedition GeForce','Holiday Park',62,1200,120,0,2001,'Haßloch','https://www.holidaypark.de',49.315300,8.278900),
  ('Untamed','Walibi Holland',36,850,90,4,2019,'Biddinghuizen','https://www.walibi.nl',52.438600,5.763900),
  ('Baron 1898','Efteling',30,500,90,1,2015,'Kaatsheuvel','https://www.efteling.com',51.650300,5.049200),
  ('Python','Efteling',22,792,75,4,1981,'Kaatsheuvel','https://www.efteling.com',51.650300,5.049200),
  ('Joris en de Draak','Efteling',22,810,75,0,2010,'Kaatsheuvel','https://www.efteling.com',51.650300,5.049200),
  ('Zadra','Energylandia',63,1316,121,3,2019,'Zator','https://energylandia.pl',49.982900,19.475600),
  ('Hyperion','Energylandia',77,1450,142,0,2018,'Zator','https://energylandia.pl',49.982900,19.475600),
  ('Shambhala','PortAventura Park',76,1650,134,0,2012,'Salou','https://www.portaventuraworld.com',41.087000,1.157000),
  ('Red Force','Ferrari Land',112,880,180,0,2017,'Salou','https://www.portaventuraworld.com',41.084600,1.152400),
  ('Steel Dragon 2000','Nagashima Spa Land',97,2479,153,0,2000,'Kuwana, Mie','https://www.nagashima-onsen.co.jp',35.029500,136.732500),
  ('Hakugei','Nagashima Spa Land',55,1530,107,3,2019,'Kuwana, Mie','https://www.nagashima-onsen.co.jp',35.029500,136.732500),
  ('Eejanaika','Fuji-Q Highland',76,1153,126,3,2006,'Fujiyoshida, Yamanashi','https://www.fujiq.jp',35.487400,138.780300),
  ('Do-Dodonpa','Fuji-Q Highland',49,1244,180,1,2001,'Fujiyoshida, Yamanashi','https://www.fujiq.jp',35.487400,138.780300),
  ('Foenix','Faarup Sommerland',40,905,90,3,2021,'Saltum','https://www.faarupsommerland.dk',57.283300,9.783300),
  ('Piraten','Djurs Sommerland',32,690,90,0,2008,'Nimtofte','https://www.djurssommerland.dk',56.383900,10.556100),
  ('Helix','Liseberg',41,1381,100,7,2014,'Gothenburg','https://www.liseberg.com',57.695900,11.991700),
  ('Balder','Liseberg',36,1070,90,0,2003,'Gothenburg','https://www.liseberg.com',57.695900,11.991700),
  ('Leviathan','Canada''s Wonderland',93,1672,148,0,2012,'Vaughan, Ontario','https://www.canadaswonderland.com',43.843000,-79.539000),
  ('Yukon Striker','Canada''s Wonderland',75,1105,130,4,2019,'Vaughan, Ontario','https://www.canadaswonderland.com',43.843000,-79.539000),
  ('DC Rivals HyperCoaster','Warner Bros. Movie World',61,1400,115,3,2017,'Oxenford, Queensland','https://movieworld.com.au',-27.920000,153.315000),
  ('Steel Taipan','Dreamworld',32,1000,105,3,2021,'Coomera, Queensland','https://www.dreamworld.com.au',-27.863600,153.315100)
) as v(name, park, height_m, length_m, speed_kmh, inversions, opened_year, park_city, park_url, latitude, longitude)
where lower(trim(c.name)) = lower(trim(v.name))
  and lower(trim(c.park)) = lower(trim(v.park));
