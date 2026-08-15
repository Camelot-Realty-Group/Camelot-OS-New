from enum import Enum
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from config.settings import DB_PATH

Base = declarative_base()

class PipelineStage(Enum):
    RAW = "RAW"
    UNDERWRITTEN = "UNDERWRITTEN"
    PUSHED_TO_HUBSPOT = "PUSHED_TO_HUBSPOT"

class Property(Base):
    __tablename__ = "properties"
    
    bbl = Column(String, primary_key=True)
    address = Column(String)
    borough = Column(String)
    block = Column(String)
    lot = Column(String)
    units_total = Column(Integer)
    owner_name = Column(String)
    year_built = Column(Integer, nullable=True)
    floors = Column(Float, default=0.0)
    
    # Unmasked Data
    contact_firstname = Column(String, nullable=True)
    contact_lastname = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_title = Column(String, nullable=True)
    unit_number = Column(String, nullable=True)
    
    # Status
    stage = Column(String, default=PipelineStage.RAW.value)
    hubspot_deal_id = Column(String, nullable=True)

engine = create_engine(f"sqlite:///{DB_PATH}")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_session():
    return SessionLocal()
