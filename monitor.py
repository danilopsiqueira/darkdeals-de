import asyncio
import json
import os
import time
from datetime import datetime
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

RADAR_FILE = "radar.json"

# Score ajustado para oportunidade únicas sub-7000€ e até 150k km
def calculate_score(price, km, year, source="marketplace"):
    score = 50
    fair_price = 14000 # Preço justo muito conservador

    if price > 0:
        ratio = price / fair_price
        if ratio < 0.4: score += 40  # <5600
        elif ratio < 0.5: score += 30 # <7000
        elif ratio < 0.6: score += 20
        elif ratio < 0.8: score += 5
        else: score -= 20

    if km <= 50000: score += 20
    elif km <= 80000: score += 15
    elif km <= 120000: score += 10
    elif km <= 150000: score += 5
    else: score -= 5

    age = 2026 - year
    if age <= 1: score += 15
    elif age <= 2: score += 10
    elif age <= 3: score += 5
    elif age <= 5: score += 2

    # Bonus massivo para dark sources nestas condições difíceis
    if source in ["leasing", "rental", "auction", "trade-in", "private"]:
        score += 10

    return max(0, min(100, score))

def load_radar():
    if os.path.exists(RADAR_FILE):
        with open(RADAR_FILE, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except:
                return []
    return []

def save_radar(deals):
    with open(RADAR_FILE, 'w', encoding='utf-8') as f:
        json.dump(deals, f, ensure_ascii=False, indent=2)

async def search_mobile_de(page):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🚙 Mobile.de (>2021, <150k, <15000€)...")
    url = "https://suchen.mobile.de/fahrzeuge/search.html?dam=0&fr=2021%3A&ml=%3A150000&pr=%3A15000&vc=Van&cn=DE&sfmr=false"
    
    new_deals = []
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(4)
        return new_deals
    except Exception as e:
        return []

async def search_autouncle(page):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 📊 AutoUncle (Filtro Super Price <15000€)...")
    url = "https://www.autouncle.de/de/gebrauchtwagen/lieferwagen?min_year=2021&max_km=150000&max_price=15000"
    
    new_deals = []
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(3)
        return new_deals
    except Exception as e:
        return []

async def search_kleinanzeigen(page):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 👑 Kleinanzeigen.de (Particulares a despachar <15000€)...")
    url = "https://www.kleinanzeigen.de/s-kastenwagen/preis::15000/k0"
    
    new_deals = []
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(4)
        return new_deals
    except Exception as e:
        return []

async def search_autoscout(page):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🔎 AutoScout24 (Limpando até 15000€)...")
    # body=6 garante APENAS Kastenwagen/Transporter (como Berlingo, Partner)
    url = "https://www.autoscout24.de/lst?atype=C&body=6&cy=D&damaged_listing=exclude&fregfrom=2021&kmto=150000&priceto=15000&sort=standard&desc=0&ustate=N%2CU"
    
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        await asyncio.sleep(4)
        
        content = await page.content()
        soup = BeautifulSoup(content, 'html.parser')
        
        articles = soup.find_all('article')
        
        new_deals = []
        for article in articles:
            try:
                title_elem = article.find('h2')
                if not title_elem: continue
                title = title_elem.text.strip()
                
                price_str = ""
                price_container = article.find(attrs={"data-testid": "regular-price"})
                if price_container: price_str = price_container.text
                
                price = 0
                if '€' in price_str:
                    num_str = ''.join(filter(str.isdigit, price_str))
                    if num_str: price = int(num_str)
                
                if price <= 0 or price > 15000: continue
                
                details = article.find_all(attrs={"data-testid": "item-details-list"})
                km = 0
                year = 2021
                if details:
                    items = details[0].find_all('li')
                    if len(items) >= 2:
                        km_str = items[0].text
                        num_km = ''.join(filter(str.isdigit, km_str))
                        if num_km: km = int(num_km)
                        
                        year_str = items[1].text
                        num_yr = ''.join(filter(str.isdigit, year_str.split('/')[-1]))
                        if num_yr and len(num_yr) == 4: year = int(num_yr)

                if year < 2021 or km > 150000: continue

                link = ""
                a_tag = article.find('a')
                if a_tag and a_tag.get('href'):
                    link = "https://www.autoscout24.de" + a_tag['href']

                uid = str(price) + "_" + str(km) + "_" + str(year)
                score = calculate_score(price, km, year)

                if score >= 40:
                    new_deals.append({
                        "id": uid,
                        "vehicle": title,
                        "price": price,
                        "km": km,
                        "year": year,
                        "fuel": "diesel",
                        "source": "marketplace",
                        "link": link,
                        "notes": "🔴 AutoScout Achado Kastenwagen <7k",
                        "score": score,
                        "addedAt": datetime.now().isoformat()
                    })

            except Exception as e:
                pass
                
        return new_deals

    except Exception as e:
        return []

async def main():
    print("🚀 Radar DEEP DARK 5.0 (WORK VANS ONLY) Iniciado")
    print("Filtros ABSOLUTOS: Ano >= 2021 | KM <= 150.000 | PREÇO <= 7000€ | TIPO = Furgões Comerciais")
    print("Oportunidades de trabalho reais no radar!")
    
    if not os.path.exists(RADAR_FILE):
        save_radar([])

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/110.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        while True:
            deals_found = []
            
            # Kleinanzeigen 
            deals_found.extend(await search_kleinanzeigen(page))
            deals_found.extend(await search_mobile_de(page))
            deals_found.extend(await search_autouncle(page))
            deals_found.extend(await search_autoscout(page))
            
            if deals_found:
                existing_deals = load_radar()
                existing_ids = {d['id'] for d in existing_deals}
                
                added = 0
                for deal in deals_found:
                    if deal['id'] not in existing_ids:
                        existing_deals.insert(0, deal)
                        added += 1
                
                if added > 0:
                    existing_deals = sorted(existing_deals, key=lambda x: x.get('score', 0), reverse=True)
                    existing_deals = existing_deals[:50]
                    save_radar(existing_deals)
                    print(f"🚨 {added} FURGÕES (<7000€) ADICIONADOS!")
                else:
                    print("⚠️ Nenhum achado. Estas margens são raras.")
            
            print(f"💤 Radar em modo furtivo a aguardar 45s...")
            await asyncio.sleep(45)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nRadar parado.")
