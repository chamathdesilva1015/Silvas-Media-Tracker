from sqlmodel import Session, select
from database import engine, MediaItem
from main import bump_data_version

# Only true franchises (either multiple entries already in DB, or genuine multi-season/spin-off universes)
GENUINE_FRANCHISES = {
    # 1. Multi-entry in DB
    "Fate/stay night [Unlimited Blade Works]": ("Fate Series", "Fate/stay night", "Alternative Route"),
    "Fate/strange Fake": ("Fate Series", "Fate/strange Fake", "Spin-off"),
    "Fullmetal Alchemist": ("Fullmetal Alchemist", "FMA (2003)", "Alternative Route"),
    "Fullmetal Alchemist: Brotherhood": ("Fullmetal Alchemist", "FMA: Brotherhood", None),
    "Naruto": ("Naruto", "Naruto Part 1", None),
    "Naruto Shippuden": ("Naruto", "Naruto Shippuden", "Sequel"),
    "Boruto: Naruto Next Generations": ("Naruto", "Boruto", "Sequel"),
    "Bleach": ("Bleach", "Bleach", None),
    "Bleach: Thousand-Year Blood War": ("Bleach", "Thousand-Year Blood War", "Sequel"),
    "Kaguya-sama: Love is War": ("Kaguya-sama: Love is War", "Season 1", None),
    "Kaguya-sama: Love is War?": ("Kaguya-sama: Love is War", "Season 2", "Sequel"),
    "The Quintessential Quintuplets": ("The Quintessential Quintuplets", "Season 1", None),
    "The Quintessential Quintuplets 2": ("The Quintessential Quintuplets", "Season 2", "Sequel"),
    "SSSS.Gridman": ("Gridman Universe", "SSSS.Gridman", None),
    "SSSS.Dynazenon": ("Gridman Universe", "SSSS.Dynazenon", "Spin-off / Sequel"),
    "Snow White with the Red Hair 2": ("Snow White with the Red Hair", "Season 2", "Sequel"),

    # 2. Cyberpunk: Edgerunners (confirmed new season in production)
    "Cyberpunk: Edgerunners": ("Cyberpunk: Edgerunners", None, None),

    # 3. Famous multi-season / multi-part universes
    "Attack on Titan": ("Attack on Titan", None, None),
    "Sword Art Online": ("Sword Art Online", None, None),
    "Re:ZERO -Starting Life in Another World-": ("Re:ZERO", None, None),
    "KonoSuba: God's Blessing on This Wonderful World!": ("KonoSuba", None, None),
    "Demon Slayer: Kimetsu no Yaiba": ("Demon Slayer", None, None),
    "Jujutsu Kaisen": ("Jujutsu Kaisen", None, None),
    "My Hero Academia": ("My Hero Academia", None, None),
    "Dr. Stone": ("Dr. Stone", None, None),
    "Haikyu!!": ("Haikyu!!", None, None),
    "Steins;Gate": ("Steins;Gate", None, None),
    "Mushoku Tensei: Jobless Reincarnation": ("Mushoku Tensei", None, None),
    "That Time I Got Reincarnated as a Slime": ("That Time I Got Reincarnated as a Slime", None, None),
    "Classroom of the Elite": ("Classroom of the Elite", None, None),
    "Vinland Saga": ("Vinland Saga", None, None),
    "Tokyo Ghoul": ("Tokyo Ghoul", None, None),
    "Food Wars! Shokugeki no Soma": ("Food Wars!", None, None),
    "A Certain Magical Index": ("A Certain Magical / Scientific Series", None, None),
    "One Piece": ("One Piece", None, None),
    "Fairy Tail": ("Fairy Tail", None, None),
    "Fire Force": ("Fire Force", None, None),
    "The Eminence in Shadow": ("The Eminence in Shadow", None, None),
    "The Seven Deadly Sins": ("The Seven Deadly Sins", None, None),
    "Tokyo Revengers": ("Tokyo Revengers", None, None),
    "Is It Wrong to Try to Pick Up Girls in a Dungeon?": ("DanMachi", None, None),
    "Code Geass: Lelouch of the Rebellion": ("Code Geass", None, None),
    "High School DxD": ("High School DxD", None, None),
    "Gintama": ("Gintama", None, None),
    "JoJo's Bizarre Adventure": ("JoJo's Bizarre Adventure", None, None),
    "Clannad": ("Clannad", None, None),
    "Made in Abyss": ("Made in Abyss", None, None),
    "Magi: The Kingdom of Magic": ("Magi", None, "Sequel"),
    "My Teen Romantic Comedy SNAFU": ("My Teen Romantic Comedy SNAFU", None, None),
    "Rascal Does Not Dream of Bunny Girl Senpai": ("Rascal Does Not Dream Series", None, None),
    "Date A Live": ("Date A Live", None, None),
    "Strike the Blood": ("Strike the Blood", None, None),
    "The Familiar of Zero": ("The Familiar of Zero", None, None),
    "Shakugan no Shana": ("Shakugan no Shana", None, None),
    "The Irregular at Magic High School": ("The Irregular at Magic High School", None, None),
    "The Misfit of Demon King Academy": ("The Misfit of Demon King Academy", None, None),
    "The Devil is a Part-Timer!": ("The Devil is a Part-Timer!", None, None),
    "Blue Exorcist": ("Blue Exorcist", None, None),
    "Blue Lock": ("Blue Lock", None, None),
}

def clean():
    with Session(engine) as s:
        anime = s.exec(select(MediaItem).where(MediaItem.type == "Anime")).all()
        cleared = 0
        updated = 0
        for a in anime:
            if a.title in GENUINE_FRANCHISES:
                f, b, r = GENUINE_FRANCHISES[a.title]
                a.anime_franchise = f
                a.anime_branch = b
                a.anime_relation = r
                s.add(a)
                updated += 1
            else:
                # Standalone anime (e.g. Orb, Toradora, Tomodachi Game, ReLIFE, etc.)
                if a.anime_franchise or a.anime_branch or a.anime_relation:
                    print(f"[-] Clearing standalone anime: {a.title} (was franchise: {a.anime_franchise})")
                    a.anime_franchise = None
                    a.anime_branch = None
                    a.anime_relation = None
                    s.add(a)
                    cleared += 1

        bump_data_version(s)
        s.commit()
        print(f"\n[DONE] Retained {updated} genuine franchise titles. Cleared {cleared} standalone titles.")

if __name__ == "__main__":
    clean()

