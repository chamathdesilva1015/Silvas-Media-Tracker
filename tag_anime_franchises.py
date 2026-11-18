import re
from sqlmodel import Session, select
from database import engine, MediaItem
from main import bump_data_version

FRANCHISE_MAP = {
    # Existing multi-entries
    "Fate/stay night [Unlimited Blade Works]": ("Fate Series", "Fate/stay night", "Alternative Route"),
    "Fate/strange Fake": ("Fate Series", "Fate/strange Fake", "Spin-off"),
    
    "Naruto": ("Naruto", "Naruto Part 1", "Main Series"),
    "Naruto Shippuden": ("Naruto", "Naruto Shippuden", "Sequel"),
    "Boruto: Naruto Next Generations": ("Naruto", "Boruto", "Sequel"),

    "Bleach": ("Bleach", "Bleach", "Main Series"),
    "Bleach: Thousand-Year Blood War": ("Bleach", "Thousand-Year Blood War", "Sequel"),

    "Fullmetal Alchemist": ("Fullmetal Alchemist", "FMA (2003)", "Alternative Route"),
    "Fullmetal Alchemist: Brotherhood": ("Fullmetal Alchemist", "FMA: Brotherhood", "Main Adaptation"),

    "Kaguya-sama: Love is War": ("Kaguya-sama: Love is War", "Season 1", "Main Series"),
    "Kaguya-sama: Love is War?": ("Kaguya-sama: Love is War", "Season 2", "Sequel"),

    "The Quintessential Quintuplets": ("The Quintessential Quintuplets", "Season 1", "Main Series"),
    "The Quintessential Quintuplets 2": ("The Quintessential Quintuplets", "Season 2", "Sequel"),

    "SSSS.Gridman": ("Gridman Universe", "SSSS.Gridman", "Main Series"),
    "SSSS.Dynazenon": ("Gridman Universe", "SSSS.Dynazenon", "Spin-off / Sequel"),

    "Snow White with the Red Hair 2": ("Snow White with the Red Hair", "Season 2", "Sequel"),

    # Multi-season franchises where user has Season 1 / one part
    "Attack on Titan": ("Attack on Titan", "Main Series", "Main Series"),
    "Re:ZERO -Starting Life in Another World-": ("Re:ZERO", "Main Series", "Main Series"),
    "KonoSuba: God's Blessing on This Wonderful World!": ("KonoSuba", "Main Series", "Main Series"),
    "Demon Slayer: Kimetsu no Yaiba": ("Demon Slayer", "Main Series", "Main Series"),
    "Jujutsu Kaisen": ("Jujutsu Kaisen", "Main Series", "Main Series"),
    "My Hero Academia": ("My Hero Academia", "Main Series", "Main Series"),
    "Sword Art Online": ("Sword Art Online", "Aincrad / Main", "Main Series"),
    "Dr. Stone": ("Dr. Stone", "Main Series", "Main Series"),
    "Haikyu!!": ("Haikyu!!", "Main Series", "Main Series"),
    "Steins;Gate": ("Steins;Gate", "Steins;Gate", "Main Series"),
    "Mushoku Tensei: Jobless Reincarnation": ("Mushoku Tensei", "Main Series", "Main Series"),
    "That Time I Got Reincarnated as a Slime": ("That Time I Got Reincarnated as a Slime", "Main Series", "Main Series"),
    "Classroom of the Elite": ("Classroom of the Elite", "Main Series", "Main Series"),
    "Vinland Saga": ("Vinland Saga", "Main Series", "Main Series"),
    "Tokyo Ghoul": ("Tokyo Ghoul", "Main Series", "Main Series"),
    "Food Wars! Shokugeki no Soma": ("Food Wars!", "Main Series", "Main Series"),
    "A Certain Magical Index": ("A Certain Magical / Scientific Series", "Index", "Main Series"),
    "Rent-a-Girlfriend": ("Rent-a-Girlfriend", "Main Series", "Main Series"),
    "Science Fell in Love, So I Tried to Prove It": ("Science Fell in Love, So I Tried to Prove It", "Season 1", "Main Series"),
    "Spy x Family": ("Spy x Family", "Main Series", "Main Series"),
    "Chainsaw Man": ("Chainsaw Man", "Main Series", "Main Series"),
    "Blue Exorcist": ("Blue Exorcist", "Main Series", "Main Series"),
    "Blue Lock": ("Blue Lock", "Main Series", "Main Series"),
    "One Piece": ("One Piece", "Main Series", "Main Series"),
    "Fairy Tail": ("Fairy Tail", "Main Series", "Main Series"),
    "Fire Force": ("Fire Force", "Main Series", "Main Series"),
    "The Eminence in Shadow": ("The Eminence in Shadow", "Main Series", "Main Series"),
    "The Seven Deadly Sins": ("The Seven Deadly Sins", "Main Series", "Main Series"),
    "Tokyo Revengers": ("Tokyo Revengers", "Main Series", "Main Series"),
    "The Irregular at Magic High School": ("The Irregular at Magic High School", "Main Series", "Main Series"),
    "The Misfit of Demon King Academy": ("The Misfit of Demon King Academy", "Main Series", "Main Series"),
    "The Devil is a Part-Timer!": ("The Devil is a Part-Timer!", "Season 1", "Main Series"),
    "Is It Wrong to Try to Pick Up Girls in a Dungeon?": ("DanMachi", "Main Series", "Main Series"),
    "Code Geass: Lelouch of the Rebellion": ("Code Geass", "Lelouch of the Rebellion", "Main Series"),
    "Date A Live": ("Date A Live", "Main Series", "Main Series"),
    "High School DxD": ("High School DxD", "Main Series", "Main Series"),
    "Strike the Blood": ("Strike the Blood", "Main Series", "Main Series"),
    "The Familiar of Zero": ("The Familiar of Zero", "Main Series", "Main Series"),
    "Shakugan no Shana": ("Shakugan no Shana", "Main Series", "Main Series"),
    "Gintama": ("Gintama", "Main Series", "Main Series"),
    "JoJo's Bizarre Adventure": ("JoJo's Bizarre Adventure", "Main Series", "Main Series"),
    "Clannad": ("Clannad", "Main Series", "Main Series"),
    "Made in Abyss": ("Made in Abyss", "Main Series", "Main Series"),
    "Magi: The Kingdom of Magic": ("Magi", "Kingdom of Magic", "Sequel"),
    "My Teen Romantic Comedy SNAFU": ("My Teen Romantic Comedy SNAFU", "Season 1", "Main Series"),
    "Rascal Does Not Dream of Bunny Girl Senpai": ("Rascal Does Not Dream Series", "Bunny Girl Senpai", "Main Series"),
    "Teasing Master Takagi-san": ("Teasing Master Takagi-san", "Main Series", "Main Series"),
    "Tonikawa: Over The Moon For You": ("Tonikawa", "Main Series", "Main Series"),
    "Solo Leveling": ("Solo Leveling", "Main Series", "Main Series"),
    "Mashle: Magic and Muscles": ("Mashle", "Main Series", "Main Series"),
    "Frieren: Beyond Journey's End": ("Frieren: Beyond Journey's End", "Main Series", "Main Series"),
    "[Oshi No Ko]": ("Oshi no Ko", "Main Series", "Main Series"),
    "Cells at Work!": ("Cells at Work!", "Main Series", "Main Series"),
    "86 Eighty-Six": ("86 Eighty-Six", "Main Series", "Main Series"),
    "Arifureta: From Commonplace to World's Strongest": ("Arifureta", "Main Series", "Main Series"),
    "Assassination Classroom": ("Assassination Classroom", "Main Series", "Main Series"),
    "Horimiya": ("Horimiya", "Main Series", "Main Series"),
    "ReLIFE": ("ReLIFE", "Main Series", "Main Series"),
    "Tomodachi Game": ("Tomodachi Game", "Main Series", "Main Series"),
    "The Apothecary Diaries": ("The Apothecary Diaries", "Main Series", "Main Series"),
    "Toradora!": ("Toradora!", "Main Series", "Main Series"),
    "No Game, No Life": ("No Game, No Life", "Main Series", "Main Series"),
    "Orb: On the Movements of the Earth": ("Orb: On the Movements of the Earth", "Main Series", "Main Series")
}

def run():
    with Session(engine) as s:
        anime = s.exec(select(MediaItem).where(MediaItem.type == "Anime")).all()
        count = 0
        for a in anime:
            if a.title in FRANCHISE_MAP:
                f, b, r = FRANCHISE_MAP[a.title]
                a.anime_franchise = f
                a.anime_branch = b
                a.anime_relation = r
                s.add(a)
                count += 1
                print(f"[+] Tagged: '{a.title}' -> Franchise: '{f}' | Branch: '{b}' | Rel: '{r}'")
        bump_data_version(s)
        s.commit()
        print(f"\n[DONE] Successfully tagged {count} anime entries with franchise hierarchy!")

if __name__ == "__main__":
    run()

