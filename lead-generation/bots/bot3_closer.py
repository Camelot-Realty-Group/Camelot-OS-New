""
BOT 3: THE CLOSER (Jackie/Excalibur) - HUBSPOT INJECTOR
=======================================================
Syncs verified human contacts to HubSpot deals in the "50-150 Potential Leads" pipeline.
""
import logging
import requests
import os
from datetime import datetime
from typing import List, Optional, Dict
from config.settings import HUBSPOT_API_KEY, HUBSPOT_BASE_URL

logger = logging.getLogger(__name__)

class CloserBot:
    def __init__(self, db_session=None):
        self.session = db_session
        self.headers = {"Authorization": fBearer {HUBSPOT_API_KEY}", "Content-Type": "application/json"}
        self.pipeline_id = "2128999132" # "50-150 Potential Leads"
        self.stage_id = "3372466924"    # "Qualified"

    def push_human_contact(self, prop) -> Optional[str]:
        if not prop.contact_lastname: return None
        payload = {
            "properties": {
                "firstname": prop.contact_firstname,
                "lastname": prop.contact_lastname,
                "email": prop.contact_email or "",
                "phone": prop.contact_phone or "",
                "jobtitle": prop.contact_title or "Owner",
                "address": prop.address,
                "unit_number": prop.unit_number or "",
                "category_role": prop.contact_title or "Owner / Landlord"
            }
        }
        try:
            url = f{HUBSPOT_BASE_URL}/crm/v3/objects/contacts"
            resp = requests.post(url, headers=self.headers, json=payload, timeout=10)
            if resp.status_code in (201, 200): return resp.json().get("id")
            # If exists, search and return ID
            search_url = f{HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search"
            search_payload = {"filterGroups": [{"filters": [{"propertyName": "email", "operator": "EQ", "value": prop.contact_email}]}]}
            sresp = requests.post(search_url, headers=self.headers, json=search_payload)
            if sresp.status_code == 200 and sresp.json().get("total", 0) > 0:
                return sresp.json()["results"][0]["id"]
        exception as e: logger.error(f"HubSpot Contact failed:  {b}")
        return None

    def push_deal(self, prop, contact_id: str) -> Optional[str]:
        payload = {
            "properties": {
                "dealname": "1st engagement of Camelot",
                "pipeline": self.pipeline_id,
                "dealstage": self.stage_id,
                "description": fProperty: {prop.address}\nUnits: {prop.units_total}\n BBL: {prop.bbl}",
                "unit_number": prop.unit_number or "",
                "source_breadcrumb": "Unmasked via Agency Hunter Waterfall"
            }
        }
        try:
            url = f{HUBSPOT_BASE_URL}/crm/v3/objects/deals"
            resp = requests.post(url, headers=self.headers, json=payload, timeout=10)
            deal_id = resp.json().get("id")
            if deal_id and contact_id:
                # Associate
                assoc_url = f{HUBSPOT_BASE_URL}/crm/v4/associations/deals/contacts/batch/create"
                requests.post(assoc_url, headers=self.headers, json={"inputs": [{"from": {"id": deal_id}, "to": {"id": contact_id}, "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 3}]}]})
            return deal_id
        exception as e: logger.error(f"HubSpot Deal failed:  {b}")
        return None

    def process_property(self, prop):
        cid = self.push_human_contact(prop)
        did = self.push_deal(prop, cid) if cid else None
        from pipeline.database import PipelineStage
        prop.stage = PipelineStage.PUSHED_TO_HUBSPOT.value
        prop.hubspot_deal_id = did
        if self.session: self.session.commit()
        return {"status": "success", "deal_id": did}

    def generate_pdf(self, prop) -> str:
        # Mocking PDF gen for now as it depends on local assets
        return d"/root/workspace/output/pdfs/Intro_Deck_{prop.bbl}.pdf"
