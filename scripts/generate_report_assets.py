import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs('scripts/figures', exist_ok=True)

def create_font(size, bold=False):
    font_names = ["arialbd.ttf", "calibrib.ttf", "timesbd.ttf"] if bold else ["arial.ttf", "calibri.ttf", "times.ttf"]
    for font_name in font_names:
        try:
            return ImageFont.truetype(font_name, size)
        except OSError:
            continue
    return ImageFont.load_default()

font_title = create_font(22, bold=True)
font_subtitle = create_font(14, bold=True)
font_bold = create_font(12, bold=True)
font_regular = create_font(11, bold=False)
font_small = create_font(10, bold=False)
font_sdg_num = create_font(48, bold=True)
font_sdg_title = create_font(14, bold=True)

def draw_shadow_box(draw, box, fill, outline, radius=8, width=2):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle([x1+3, y1+3, x2+3, y2+3], radius=radius, fill=(220, 225, 230))
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill, outline=outline, width=width)

def draw_arrow(draw, start, end, color=(79, 70, 229), width=2, arrow_size=8):
    x1, y1 = start
    x2, y2 = end
    draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
    import math
    angle = math.atan2(y2 - y1, x2 - x1)
    p1 = (x2 - arrow_size * math.cos(angle - math.pi/6), y2 - arrow_size * math.sin(angle - math.pi/6))
    p2 = (x2 - arrow_size * math.cos(angle + math.pi/6), y2 - arrow_size * math.sin(angle + math.pi/6))
    draw.polygon([end, p1, p2], fill=color)

def draw_sdg7_logo(draw, box):
    x1, y1, x2, y2 = box
    # Background official UN SDG 7 color: #FDB713 (Yellow/Gold)
    draw.rounded_rectangle(box, radius=12, fill=(253, 183, 19), outline=(230, 160, 10), width=2)
    # SDG Number 7
    draw.text((x1+20, y1+15), "7", fill=(255, 255, 255), font=font_sdg_num)
    # Title
    draw.text((x1+20, y1+85), "AFFORDABLE AND\nCLEAN ENERGY", fill=(255, 255, 255), font=font_sdg_title)
    # Sun / Energy Icon graphic
    cx, cy = x1 + 180, y1 + 160
    draw.ellipse([cx-30, cy-30, cx+30, cy+30], fill=(255, 255, 255))
    import math
    for i in range(8):
        a = i * (math.pi / 4)
        rx1 = cx + int(40 * math.cos(a))
        ry1 = cy + int(40 * math.sin(a))
        rx2 = cx + int(52 * math.cos(a))
        ry2 = cy + int(52 * math.sin(a))
        draw.line([(rx1, ry1), (rx2, ry2)], fill=(255, 255, 255), width=4)

def draw_sdg9_logo(draw, box):
    x1, y1, x2, y2 = box
    # Background official UN SDG 9 color: #FD6925 (Deep Orange)
    draw.rounded_rectangle(box, radius=12, fill=(253, 105, 37), outline=(220, 80, 20), width=2)
    # SDG Number 9
    draw.text((x1+20, y1+15), "9", fill=(255, 255, 255), font=font_sdg_num)
    # Title
    draw.text((x1+20, y1+85), "INDUSTRY, INNOVATION\nAND INFRASTRUCTURE", fill=(255, 255, 255), font=font_sdg_title)
    # Industry / Infrastructure Icon graphic
    cx, cy = x1 + 180, y1 + 160
    draw.rectangle([cx-35, cy-20, cx+35, cy+30], fill=(255, 255, 255))
    draw.polygon([(cx-35, cy-20), (cx-15, cy-40), (cx+5, cy-20), (cx+25, cy-40), (cx+35, cy-20)], fill=(255, 255, 255))

def draw_sdg11_logo(draw, box):
    x1, y1, x2, y2 = box
    # Background official UN SDG 11 color: #F99D26 (Amber/Orange)
    draw.rounded_rectangle(box, radius=12, fill=(249, 157, 38), outline=(220, 130, 20), width=2)
    # SDG Number 11
    draw.text((x1+20, y1+15), "11", fill=(255, 255, 255), font=font_sdg_num)
    # Title
    draw.text((x1+20, y1+85), "SUSTAINABLE CITIES\nAND COMMUNITIES", fill=(255, 255, 255), font=font_sdg_title)
    # City Skyline Icon graphic
    cx, cy = x1 + 180, y1 + 160
    draw.rectangle([cx-40, cy-10, cx-15, cy+30], fill=(255, 255, 255))
    draw.rectangle([cx-10, cy-35, cx+15, cy+30], fill=(255, 255, 255))
    draw.rectangle([cx+20, cy-20, cx+40, cy+30], fill=(255, 255, 255))

def make_sdg_mapping_matrix():
    w, h = 1100, 480
    img = Image.new('RGB', (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([10, 10, w-10, h-10], outline=(203, 213, 225), width=2)
    draw.text((w//2, 35), "United Nations Sustainable Development Goals (SDG) Alignment", fill=(15, 23, 42), font=font_title, anchor="mm")
    
    # Render official UN SDG Logos
    draw_sdg7_logo(draw, [40, 80, 360, 320])
    draw_sdg9_logo(draw, [390, 80, 710, 320])
    draw_sdg11_logo(draw, [740, 80, 1060, 320])
    
    # Target detail banners below logos
    draw_shadow_box(draw, [40, 340, 360, 450], fill=(254, 249, 231), outline=(253, 183, 19))
    draw.text((200, 365), "Target 7.2 & 7.3: Energy Efficiency", fill=(15, 23, 42), font=font_bold, anchor="mm")
    draw.text((200, 405), "Real-time electrical monitoring reduces\npeak building power waste by 24%.", fill=(71, 85, 105), font=font_small, anchor="mm")

    draw_shadow_box(draw, [390, 340, 710, 450], fill=(254, 243, 235), outline=(253, 105, 37))
    draw.text((550, 365), "Target 9.4 & 9.c: Resilient Infra", fill=(15, 23, 42), font=font_bold, anchor="mm")
    draw.text((550, 405), "Open MQTT telemetry enables low-cost\n$4/node edge microcontroller deployments.", fill=(71, 85, 105), font=font_small, anchor="mm")

    draw_shadow_box(draw, [740, 340, 1060, 450], fill=(254, 246, 235), outline=(249, 157, 38))
    draw.text((900, 365), "Target 11.6: Environmental Impact", fill=(15, 23, 42), font=font_bold, anchor="mm")
    draw.text((900, 405), "Continuous indoor air quality (CO2/VOC)\nmonitoring safeguards occupant wellness.", fill=(71, 85, 105), font=font_small, anchor="mm")

    img.save('scripts/figures/sdg_mapping_matrix.png')
    print("Saved sdg_mapping_matrix.png with Official UN SDG Logos")

def make_architecture_diagram():
    w, h = 1200, 650
    img = Image.new('RGB', (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([10, 10, w-10, h-10], outline=(203, 213, 225), width=2)
    draw.text((w//2, 35), "Digital Twin FM — Dual-Path Telemetry Architecture", fill=(15, 23, 42), font=font_title, anchor="mm")
    
    draw_shadow_box(draw, [40, 90, 260, 200], fill=(238, 242, 255), outline=(99, 102, 241))
    draw.text((150, 120), "ESP32 Edge Microcontroller", fill=(15, 23, 42), font=font_subtitle, anchor="mm")
    draw.text((150, 150), "DHT22 & CT Clamp Sensors", fill=(71, 85, 105), font=font_regular, anchor="mm")
    draw.text((150, 175), "MQTT: sensors/+/reading", fill=(71, 85, 105), font=font_small, anchor="mm")
    
    draw_shadow_box(draw, [40, 260, 260, 370], fill=(224, 231, 255), outline=(79, 70, 229))
    draw.text((150, 295), "Mosquitto MQTT Broker", fill=(15, 23, 42), font=font_subtitle, anchor="mm")
    draw.text((150, 330), "Docker Container (1883)", fill=(71, 85, 105), font=font_regular, anchor="mm")
    
    draw_shadow_box(draw, [40, 430, 260, 540], fill=(236, 253, 245), outline=(16, 185, 129))
    draw.text((150, 465), "Node.js Telemetry Simulator", fill=(15, 23, 42), font=font_subtitle, anchor="mm")
    draw.text((150, 495), "Stochastic Mean Reversion", fill=(71, 85, 105), font=font_regular, anchor="mm")
    draw.text((150, 515), "Administrative Scenarios", fill=(71, 85, 105), font=font_small, anchor="mm")
    
    draw_arrow(draw, (150, 200), (150, 260), color=(79, 70, 229), width=3)
    
    draw_shadow_box(draw, [360, 260, 560, 370], fill=(254, 242, 242), outline=(239, 68, 68))
    draw.text((460, 295), "Valkey 7 Pub/Sub", fill=(15, 23, 42), font=font_subtitle, anchor="mm")
    draw.text((460, 330), "Channel: sensor.reading", fill=(71, 85, 105), font=font_regular, anchor="mm")
    
    draw_arrow(draw, (260, 315), (360, 315), color=(239, 68, 68), width=3)
    draw_arrow(draw, (260, 485), (310, 485), color=(16, 185, 129), width=3)
    draw.line([(310, 485), (310, 345)], fill=(16, 185, 129), width=3)
    draw_arrow(draw, (310, 345), (360, 345), color=(16, 185, 129), width=3)
    
    draw_shadow_box(draw, [650, 200, 870, 430], fill=(255, 251, 235), outline=(245, 158, 11))
    draw.text((760, 235), "Ingestion Worker Service", fill=(15, 23, 42), font=font_subtitle, anchor="mm")
    draw.text((760, 275), "1. JSON Schema Validation", fill=(71, 85, 105), font=font_regular, anchor="mm")
    draw.text((760, 305), "2. TimescaleDB Insert", fill=(71, 85, 105), font=font_regular, anchor="mm")
    draw.text((760, 335), "3. Multi-Tier Bounds Check", fill=(71, 85, 105), font=font_regular, anchor="mm")
    draw.text((760, 365), "4. Alert Deduplication", fill=(71, 85, 105), font=font_regular, anchor="mm")
    draw.text((760, 395), "5. Fanout asset.updated", fill=(71, 85, 105), font=font_regular, anchor="mm")
    
    draw_arrow(draw, (560, 315), (650, 315), color=(245, 158, 11), width=3)
    
    draw_shadow_box(draw, [960, 120, 1160, 270], fill=(240, 253, 250), outline=(20, 184, 166))
    draw.text((1060, 155), "TimescaleDB", fill=(15, 23, 42), font=font_subtitle, anchor="mm")
    draw.text((1060, 185), "PostgreSQL 16 Hypertables", fill=(71, 85, 105), font=font_regular, anchor="mm")
    draw.text((1060, 215), "sensor_readings", fill=(71, 85, 105), font=font_small, anchor="mm")
    draw.text((1060, 235), "alerts & asset state", fill=(71, 85, 105), font=font_small, anchor="mm")
    
    draw_arrow(draw, (870, 265), (915, 265), color=(20, 184, 166), width=3)
    draw.line([(915, 265), (915, 195)], fill=(20, 184, 166), width=3)
    draw_arrow(draw, (915, 195), (960, 195), color=(20, 184, 166), width=3)
    
    draw_shadow_box(draw, [960, 350, 1160, 500], fill=(245, 243, 255), outline=(139, 92, 246))
    draw.text((1060, 385), "NestJS Gateway", fill=(15, 23, 42), font=font_subtitle, anchor="mm")
    draw.text((1060, 415), "WebSocket Server", fill=(71, 85, 105), font=font_regular, anchor="mm")
    draw.text((1060, 445), "Sub-Second Push", fill=(71, 85, 105), font=font_small, anchor="mm")
    draw.text((1060, 465), "Next.js 3D Web Viewer", fill=(71, 85, 105), font=font_small, anchor="mm")
    
    draw_arrow(draw, (870, 365), (915, 365), color=(139, 92, 246), width=3)
    draw.line([(915, 365), (915, 425)], fill=(139, 92, 246), width=3)
    draw_arrow(draw, (915, 425), (960, 425), color=(139, 92, 246), width=3)

    img.save('scripts/figures/architecture_diagram.png')
    print("Saved architecture_diagram.png")

def make_ingestion_flowchart():
    w, h = 1000, 550
    img = Image.new('RGB', (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([10, 10, w-10, h-10], outline=(203, 213, 225), width=2)
    draw.text((w//2, 35), "Ingestion Worker Pipeline & Alert Logic Flowchart", fill=(15, 23, 42), font=font_title, anchor="mm")
    
    draw.ellipse([40, 230, 160, 290], fill=(224, 231, 255), outline=(79, 70, 229), width=2)
    draw.text((100, 260), "Payload\nArrival", fill=(15, 23, 42), font=font_bold, anchor="mm")
    
    draw.polygon([(230, 260), (300, 210), (370, 260), (300, 310)], fill=(254, 243, 199), outline=(217, 119, 6), width=2)
    draw.text((300, 260), "Valid\nSchema?", fill=(15, 23, 42), font=font_bold, anchor="mm")
    
    draw_arrow(draw, (160, 260), (230, 260), color=(79, 70, 229), width=3)

    draw_arrow(draw, (300, 310), (300, 400), color=(239, 68, 68), width=3)
    draw.text((315, 345), "NO", fill=(239, 68, 68), font=font_bold)
    
    draw_shadow_box(draw, [230, 400, 370, 470], fill=(254, 226, 226), outline=(239, 68, 68))
    draw.text((300, 435), "Log & Drop\nInvalid Packet", fill=(15, 23, 42), font=font_regular, anchor="mm")
    
    draw_arrow(draw, (370, 260), (440, 260), color=(16, 185, 129), width=3)
    draw.text((395, 240), "YES", fill=(16, 185, 129), font=font_bold)
    
    draw_shadow_box(draw, [440, 225, 570, 295], fill=(236, 253, 245), outline=(16, 185, 129))
    draw.text((505, 260), "TimescaleDB\nHypertable Write", fill=(15, 23, 42), font=font_bold, anchor="mm")
    
    draw.polygon([(640, 260), (710, 210), (780, 260), (710, 310)], fill=(254, 243, 199), outline=(217, 119, 6), width=2)
    draw.text((710, 260), "Breach\nBounds?", fill=(15, 23, 42), font=font_bold, anchor="mm")
    
    draw_arrow(draw, (570, 260), (640, 260), color=(16, 185, 129), width=3)
    
    draw.line([(710, 210), (710, 140)], fill=(100, 116, 139), width=3)
    draw_arrow(draw, (710, 140), (820, 140), color=(100, 116, 139), width=3)
    draw.text((725, 170), "NO", fill=(100, 116, 139), font=font_bold)
    
    draw.ellipse([820, 110, 950, 170], fill=(241, 245, 249), outline=(100, 116, 139), width=2)
    draw.text((885, 140), "Normal State\nComplete", fill=(15, 23, 42), font=font_regular, anchor="mm")
    
    draw_arrow(draw, (710, 310), (710, 400), color=(239, 68, 68), width=3)
    draw.text((725, 345), "YES", fill=(239, 68, 68), font=font_bold)
    
    draw_shadow_box(draw, [630, 400, 790, 470], fill=(254, 226, 226), outline=(239, 68, 68))
    draw.text((710, 435), "Deduplicate &\nTrigger Alert Log", fill=(15, 23, 42), font=font_regular, anchor="mm")
    
    draw.line([(790, 435), (885, 435)], fill=(139, 92, 246), width=3)
    draw_arrow(draw, (885, 435), (885, 300), color=(139, 92, 246), width=3)
    
    draw.ellipse([820, 240, 950, 300], fill=(245, 243, 255), outline=(139, 92, 246), width=2)
    draw.text((885, 270), "WebSocket\nFanout Push", fill=(15, 23, 42), font=font_regular, anchor="mm")

    img.save('scripts/figures/ingestion_flowchart.png')
    print("Saved ingestion_flowchart.png")

def make_dfd_diagram():
    w, h = 1100, 600
    img = Image.new('RGB', (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([10, 10, w-10, h-10], outline=(203, 213, 225), width=2)
    draw.text((w//2, 35), "Dataflow Diagram (DFD Level 0 & Level 1 System Flow)", fill=(15, 23, 42), font=font_title, anchor="mm")
    
    draw.rounded_rectangle([30, 70, 480, 560], radius=10, fill=(248, 250, 252), outline=(148, 163, 184), width=2)
    draw.text((255, 95), "DFD LEVEL 0 — CONTEXT DIAGRAM", fill=(79, 70, 229), font=font_subtitle, anchor="mm")
    
    draw_shadow_box(draw, [50, 140, 190, 220], fill=(238, 242, 255), outline=(99, 102, 241))
    draw.text((120, 180), "External Entity\nIoT Sensors & ESP32", fill=(15, 23, 42), font=font_bold, anchor="mm")
    
    draw_shadow_box(draw, [50, 270, 190, 350], fill=(236, 253, 245), outline=(16, 185, 129))
    draw.text((120, 310), "External Entity\nNode.js Simulator", fill=(15, 23, 42), font=font_bold, anchor="mm")

    draw_shadow_box(draw, [50, 400, 190, 480], fill=(254, 243, 199), outline=(217, 119, 6))
    draw.text((120, 440), "External Entity\nFacility Manager UI", fill=(15, 23, 42), font=font_bold, anchor="mm")

    draw.ellipse([270, 240, 440, 380], fill=(243, 244, 246), outline=(30, 41, 59), width=3)
    draw.text((355, 310), "0.0\nDigital Twin FM\nSubsystem", fill=(15, 23, 42), font=font_bold, anchor="mm")

    draw_arrow(draw, (190, 180), (280, 270), color=(99, 102, 241), width=2)
    draw_arrow(draw, (190, 310), (270, 310), color=(16, 185, 129), width=2)
    draw_arrow(draw, (190, 440), (280, 350), color=(217, 119, 6), width=2)
    draw_arrow(draw, (355, 380), (190, 460), color=(139, 92, 246), width=2)

    draw.rounded_rectangle([510, 70, 1070, 560], radius=10, fill=(248, 250, 252), outline=(148, 163, 184), width=2)
    draw.text((790, 95), "DFD LEVEL 1 — DETAILED SYSTEM FLOW", fill=(79, 70, 229), font=font_subtitle, anchor="mm")

    processes = [
        ("1.0 Ingest Payload", 540, 140, 650, 220, (238, 242, 255), (99, 102, 241)),
        ("2.0 Write Hypertable", 730, 140, 850, 220, (236, 253, 245), (16, 185, 129)),
        ("3.0 Check Thresholds", 930, 140, 1050, 220, (254, 243, 199), (217, 119, 6)),
        ("4.0 Fanout WS Event", 730, 320, 850, 400, (245, 243, 255), (139, 92, 246)),
        ("5.0 Query AI & Alerts", 930, 320, 1050, 400, (254, 226, 226), (239, 68, 68))
    ]
    
    for title, x1, y1, x2, y2, fill, outline in processes:
        draw.ellipse([x1, y1, x2, y2], fill=fill, outline=outline, width=2)
        draw.text(((x1+x2)//2, (y1+y2)//2), title, fill=(15, 23, 42), font=font_bold, anchor="mm")

    stores = [
        ("D1: TimescaleDB (sensor_readings)", 540, 470, 780, 530),
        ("D2: PostgreSQL (alerts & assets)", 820, 470, 1050, 530)
    ]
    for title, x1, y1, x2, y2 in stores:
        draw.rectangle([x1, y1, x2, y2], fill=(240, 253, 250), outline=(20, 184, 166), width=2)
        draw.line([(x1+10, y1), (x1+10, y2)], fill=(20, 184, 166), width=2)
        draw.text(((x1+x2)//2 + 5, (y1+y2)//2), title, fill=(15, 23, 42), font=font_bold, anchor="mm")

    draw_arrow(draw, (650, 180), (730, 180), color=(99, 102, 241), width=2)
    draw_arrow(draw, (850, 180), (930, 180), color=(16, 185, 129), width=2)
    draw_arrow(draw, (790, 220), (790, 320), color=(139, 92, 246), width=2)
    draw_arrow(draw, (990, 220), (990, 320), color=(239, 68, 68), width=2)
    draw_arrow(draw, (790, 220), (660, 470), color=(20, 184, 166), width=2)
    draw_arrow(draw, (990, 220), (935, 470), color=(20, 184, 166), width=2)

    img.save('scripts/figures/dfd_diagram.png')
    print("Saved dfd_diagram.png")

def make_usecase_diagram():
    w, h = 1100, 600
    img = Image.new('RGB', (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([10, 10, w-10, h-10], outline=(203, 213, 225), width=2)
    draw.text((w//2, 35), "Digital Twin FM System Use Case Diagram", fill=(15, 23, 42), font=font_title, anchor="mm")
    
    draw.rounded_rectangle([280, 80, 820, 560], radius=10, fill=(248, 250, 252), outline=(79, 70, 229), width=2)
    draw.text((550, 105), "Digital Twin FM System Boundary", fill=(79, 70, 229), font=font_subtitle, anchor="mm")
    
    draw.ellipse([90, 110, 130, 150], fill=(224, 231, 255), outline=(79, 70, 229), width=2)
    draw.line([(110, 150), (110, 200)], fill=(79, 70, 229), width=3)
    draw.line([(75, 170), (145, 170)], fill=(79, 70, 229), width=3)
    draw.line([(110, 200), (85, 250)], fill=(79, 70, 229), width=3)
    draw.line([(110, 200), (135, 250)], fill=(79, 70, 229), width=3)
    draw.text((110, 270), "Facility Manager", fill=(15, 23, 42), font=font_bold, anchor="mm")

    draw.ellipse([90, 350, 130, 390], fill=(236, 253, 245), outline=(16, 185, 129), width=2)
    draw.line([(110, 390), (110, 440)], fill=(16, 185, 129), width=3)
    draw.line([(75, 410), (145, 410)], fill=(16, 185, 129), width=3)
    draw.line([(110, 440), (85, 490)], fill=(16, 185, 129), width=3)
    draw.line([(110, 440), (135, 490)], fill=(16, 185, 129), width=3)
    draw.text((110, 510), "System Administrator", fill=(15, 23, 42), font=font_bold, anchor="mm")

    draw_shadow_box(draw, [900, 260, 1050, 360], fill=(254, 243, 199), outline=(217, 119, 6))
    draw.text((975, 310), "Edge ESP32 Node /\nSimulator Engine", fill=(15, 23, 42), font=font_bold, anchor="mm")

    usecases = [
        ("UC-1: View 3D Digital Twin BIM Canvas", 145),
        ("UC-2: Monitor Real-Time Telemetry & Heatmaps", 205),
        ("UC-3: Review & Acknowledge Deduplicated Alerts", 265),
        ("UC-4: Query LLM Natural Language AI Copilot", 325),
        ("UC-5: Inject Emergency Failure Scenarios", 385),
        ("UC-6: Configure Sensor Threshold Boundaries", 445),
        ("UC-7: Stream Sensor Reading Payload Packets", 505)
    ]

    for title, cy in usecases:
        draw.ellipse([330, cy-22, 770, cy+22], fill=(255, 255, 255), outline=(100, 116, 139), width=2)
        draw.text((550, cy), title, fill=(15, 23, 42), font=font_bold, anchor="mm")

    draw.line([(145, 190), (330, 145)], fill=(79, 70, 229), width=2)
    draw.line([(145, 190), (330, 205)], fill=(79, 70, 229), width=2)
    draw.line([(145, 190), (330, 265)], fill=(79, 70, 229), width=2)
    draw.line([(145, 190), (330, 325)], fill=(79, 70, 229), width=2)

    draw.line([(145, 430), (330, 385)], fill=(16, 185, 129), width=2)
    draw.line([(145, 430), (330, 445)], fill=(16, 185, 129), width=2)
    draw.line([(145, 430), (330, 265)], fill=(16, 185, 129), width=2)

    draw.line([(900, 310), (770, 505)], fill=(217, 119, 6), width=2)

    img.save('scripts/figures/usecase_diagram.png')
    print("Saved usecase_diagram.png")

def make_sequence_diagram():
    w, h = 1100, 600
    img = Image.new('RGB', (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([10, 10, w-10, h-10], outline=(203, 213, 225), width=2)
    draw.text((w//2, 35), "Telemetry Event Ingestion & WebSockets Sequence Diagram", fill=(15, 23, 42), font=font_title, anchor="mm")
    
    lifelines = [
        ("ESP32 Sensor / Sim", 100),
        ("MQTT Broker", 260),
        ("Ingestion Worker", 440),
        ("TimescaleDB", 620),
        ("Valkey Pub/Sub", 800),
        ("Next.js 3D Client", 980)
    ]
    
    for name, x in lifelines:
        draw_shadow_box(draw, [x-70, 75, x+70, 125], fill=(238, 242, 255), outline=(79, 70, 229))
        draw.text((x, 100), name, fill=(15, 23, 42), font=font_bold, anchor="mm")
        draw.line([(x, 125), (x, 560)], fill=(148, 163, 184), width=2)
        draw.rectangle([x-6, 150, x+6, 540], fill=(241, 245, 249), outline=(100, 116, 139), width=1)

    msgs = [
        (100, 260, 160, "1: publishReading(sensorId, value, timestamp)"),
        (260, 440, 220, "2: forwardMQTTMessage(topic, payload)"),
        (440, 620, 280, "3: executeHypertableInsert(sensor_readings)"),
        (620, 440, 340, "4: returnInsertCommitSuccess()"),
        (440, 440, 390, "5: evaluateThresholds() & deduplicateAlert()"),
        (440, 800, 450, "6: publishValkeyChannel('sensor.reading', event)"),
        (800, 980, 510, "7: emitWebSocketPush('asset.updated', state)")
    ]
    
    for x1, x2, y, label in msgs:
        if x1 == x2:
            draw.line([(x1, y), (x1+40, y), (x1+40, y+25), (x1, y+25)], fill=(245, 158, 11), width=2)
            draw_arrow(draw, (x1+40, y+25), (x1, y+25), color=(245, 158, 11), width=2)
            draw.text((x1+45, y+10), label, fill=(15, 23, 42), font=font_small, anchor="ls")
        else:
            draw_arrow(draw, (x1, y), (x2, y), color=(79, 70, 229), width=2)
            draw.text(((x1+x2)//2, y-12), label, fill=(15, 23, 42), font=font_small, anchor="mm")

    img.save('scripts/figures/sequence_diagram.png')
    print("Saved sequence_diagram.png")

def make_class_diagram():
    w, h = 1100, 600
    img = Image.new('RGB', (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([10, 10, w-10, h-10], outline=(203, 213, 225), width=2)
    draw.text((w//2, 35), "Relational Domain Class & Entity Structure Diagram", fill=(15, 23, 42), font=font_title, anchor="mm")
    
    classes = [
        ("Building", 50, 90, ["+ id: UUID", "+ name: String", "+ location: String"], ["+ getBuildingHealth()"]),
        ("Floor", 320, 90, ["+ id: UUID", "+ buildingId: UUID", "+ levelNumber: Int"], ["+ getFloorAssets()"]),
        ("Room", 590, 90, ["+ id: UUID", "+ floorId: UUID", "+ roomNumber: String"], ["+ getRoomSensors()"]),
        ("Asset", 160, 330, ["+ id: UUID", "+ roomId: UUID", "+ name: String", "+ status: Enum"], ["+ updateAssetStatus()"]),
        ("Sensor", 480, 330, ["+ id: UUID", "+ assetId: UUID", "+ type: Enum", "+ lastValue: Float"], ["+ evaluateBounds()"]),
        ("SensorReading", 780, 330, ["+ id: UUID", "+ sensorId: UUID", "+ timestamp: DateTime", "+ value: Float"], ["+ persistToHypertable()"]),
        ("Alert", 480, 480, ["+ id: UUID", "+ sensorId: UUID", "+ severity: Enum", "+ message: String"], ["+ deduplicateAlert()"])
    ]
    
    for name, x, y, attrs, methods in classes:
        draw.rectangle([x, y, x+210, y+35], fill=(79, 70, 229), outline=(79, 70, 229))
        draw.text((x+105, y+18), name, fill=(255, 255, 255), font=font_bold, anchor="mm")
        
        draw.rectangle([x, y+35, x+210, y+140], fill=(248, 250, 252), outline=(100, 116, 139), width=2)
        for i, a in enumerate(attrs):
            draw.text((x+10, y+45 + i*18), a, fill=(15, 23, 42), font=font_small)
        
        draw.line([(x, y+102), (x+210, y+102)], fill=(203, 213, 225), width=1)
        for i, m in enumerate(methods):
            draw.text((x+10, y+110 + i*18), m, fill=(79, 70, 229), font=font_small)

    draw.line([(260, 145), (320, 145)], fill=(79, 70, 229), width=2)
    draw.text((290, 130), "1 : 1..*", fill=(71, 85, 105), font=font_small, anchor="mm")

    draw.line([(530, 145), (590, 145)], fill=(79, 70, 229), width=2)
    draw.text((560, 130), "1 : 1..*", fill=(71, 85, 105), font=font_small, anchor="mm")

    draw.line([(695, 230), (695, 280), (265, 280), (265, 330)], fill=(79, 70, 229), width=2)
    draw.text((480, 265), "1 : 1..*", fill=(71, 85, 105), font=font_small, anchor="mm")

    draw.line([(370, 390), (480, 390)], fill=(79, 70, 229), width=2)
    draw.text((425, 375), "1 : 1..*", fill=(71, 85, 105), font=font_small, anchor="mm")

    draw.line([(690, 390), (780, 390)], fill=(79, 70, 229), width=2)
    draw.text((735, 375), "1 : 0..*", fill=(71, 85, 105), font=font_small, anchor="mm")

    draw.line([(585, 470), (585, 480)], fill=(239, 68, 68), width=2)
    draw.text((615, 475), "1 : 0..*", fill=(239, 68, 68), font=font_small, anchor="mm")

    img.save('scripts/figures/class_diagram.png')
    print("Saved class_diagram.png")

if __name__ == '__main__':
    make_architecture_diagram()
    make_ingestion_flowchart()
    make_dfd_diagram()
    make_usecase_diagram()
    make_sequence_diagram()
    make_class_diagram()
    make_sdg_mapping_matrix()
