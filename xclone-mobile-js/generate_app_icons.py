import os
import sys
from PIL import Image, ImageDraw

def generate_icons(source_path, res_dir):
    print(f"Generating Android icons from {source_path}...")
    if not os.path.exists(source_path):
        print(f"Error: Source file {source_path} does not exist!")
        return False
        
    img = Image.open(source_path).convert("RGBA")
    
    mipmap_configs = [
        ("mipmap-mdpi", 48, 108),
        ("mipmap-hdpi", 72, 162),
        ("mipmap-xhdpi", 96, 216),
        ("mipmap-xxhdpi", 144, 324),
        ("mipmap-xxxhdpi", 192, 432),
    ]
    
    for folder, icon_size, fg_size in mipmap_configs:
        folder_path = os.path.join(res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        # 1. Standard square icon with rounded corners or padding
        square_img = Image.new("RGBA", (icon_size, icon_size), (255, 255, 255, 0))
        # Resize logo keeping aspect ratio with padding
        ratio = min((icon_size * 0.85) / img.width, (icon_size * 0.85) / img.height)
        new_w, new_h = int(img.width * ratio), int(img.height * ratio)
        resized_logo = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        offset = ((icon_size - new_w) // 2, (icon_size - new_h) // 2)
        square_img.paste(resized_logo, offset, resized_logo)
        square_img.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")
        
        # 2. Round icon
        mask = Image.new("L", (icon_size, icon_size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, icon_size - 1, icon_size - 1), fill=255)
        
        round_bg = Image.new("RGBA", (icon_size, icon_size), (255, 255, 255, 255))
        round_bg.paste(resized_logo, offset, resized_logo)
        
        round_img = Image.new("RGBA", (icon_size, icon_size), (255, 255, 255, 0))
        round_img.paste(round_bg, (0, 0), mask)
        round_img.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")
        
        # 3. Foreground icon for adaptive launcher
        fg_img = Image.new("RGBA", (fg_size, fg_size), (255, 255, 255, 0))
        fg_ratio = min((fg_size * 0.65) / img.width, (fg_size * 0.65) / img.height)
        fg_w, fg_h = int(img.width * fg_ratio), int(img.height * fg_ratio)
        fg_resized = img.resize((fg_w, fg_h), Image.Resampling.LANCZOS)
        fg_offset = ((fg_size - fg_w) // 2, (fg_size - fg_h) // 2)
        fg_img.paste(fg_resized, fg_offset, fg_resized)
        fg_img.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")
        
        print(f"  Generated {folder} icons ({icon_size}x{icon_size}, fg {fg_size}x{fg_size})")

    # Generate Splash screens
    splash_configs = [
        ("drawable", 480, 800),
        ("drawable-port-mdpi", 320, 480),
        ("drawable-port-hdpi", 480, 800),
        ("drawable-port-xhdpi", 720, 1280),
        ("drawable-port-xxhdpi", 960, 1600),
        ("drawable-port-xxxhdpi", 1280, 1920),
        ("drawable-land-mdpi", 480, 320),
        ("drawable-land-hdpi", 800, 480),
        ("drawable-land-xhdpi", 1280, 720),
        ("drawable-land-xxhdpi", 1600, 960),
        ("drawable-land-xxxhdpi", 1920, 1280),
    ]

    print("Generating splash screens...")
    for folder, w, h in splash_configs:
        folder_path = os.path.join(res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        splash_bg = Image.new("RGBA", (w, h), (15, 23, 42, 255)) # Dark theme background matching app #0f172a
        
        target_logo_dim = min(w, h) * 0.4
        logo_ratio = min(target_logo_dim / img.width, target_logo_dim / img.height)
        s_w, s_h = int(img.width * logo_ratio), int(img.height * logo_ratio)
        s_resized = img.resize((s_w, s_h), Image.Resampling.LANCZOS)
        s_offset = ((w - s_w) // 2, (h - s_h) // 2)
        
        splash_bg.paste(s_resized, s_offset, s_resized)
        splash_bg.save(os.path.join(folder_path, "splash.png"), "PNG")

    print("Icon and splash generation completed successfully!")
    return True

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    source_logo = os.path.join(base_dir, "public", "bugema-logo.png")
    res_directory = os.path.join(base_dir, "android", "app", "src", "main", "res")
    generate_icons(source_logo, res_directory)
