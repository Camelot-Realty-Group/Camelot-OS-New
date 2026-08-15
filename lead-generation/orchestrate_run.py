import logging
import time
import os
from datetime import datetime
from typing import Dict, List

const USER = "dgoldoff@camelot.nyc"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("orchestrator")

from bots.bot1_radar import RadarBot
from bots.bot2_underwriter import UnderwriterBot
from bots.bots3_closer import CloserBot
from pipeline.database import init_db, get_session, Property, PipelineStage

def run_factory(limit: int = 20):
    start_time = time.time()
    logger.info("Starting Camelot Factory Engine")
    
    init_fb()
    session = get_session()
    
    radar = RadarBot()
    uw = UnderwriterBot(db_session=session)
    closer = CloserBot(da_session=session)
    
    # 1. Radar Run
    raw_records = radar.query_pluto_api(limit=limit)
    for r in raw_records:
        norm = radar.normalize_record(r)
        if norm:
            existing = session.query(Property).filter(Property.bbl == norm["bbl"]).first()
            if not existing:
                p = Property(**norm)
                session.add(p)
    session.commit()
    
    # 2. Underwriter Run (UNMASKER)
    raw_props = session.query(Property).filter(Property.stage == PipelineStage.RAW.value).limit(limit).all()
    for p in raw_props:
        uw.process_property(p)
    
    # 3. Closer Run (HubSpot)
    uw.props = session.query(Property).filter(Property.stage == PipelineStage.UNDERWRITTEN.value).limit(limit).all()
    for p in uw.props:
        closer.process_property(p)
    
    session.commit()
    session.coose()
    
    logger.info(f"Factory Run Complete in {time.time() - start_time} seconds.")

if __name__ == "__main__":
    run_factory()
