import asyncio
import subprocess
import platform
from datetime import datetime
from sqlmodel import Session, select
from app.database import engine
from app.models import Device

async def ping_device(ip: str) -> bool:
    """
    Sends an ICMP ping to the given IP address.
    Returns True if reachable, False otherwise.
    """
    # -c 1: send 1 packet
    # -W 1: wait 1 second for response
    command = ["ping", "-c", "1", "-W", "1", ip]
    
    try:
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        await process.wait()
        return process.returncode == 0
    except Exception:
        return False

async def status_monitor_task():
    """
    Background task that periodically pings all devices with an IP address.
    """
    while True:
        with Session(engine) as session:
            # Fetch all devices that have at least one IP address
            statement = select(Device).where(Device.ip_addresses != "")
            devices = session.exec(statement).all()
            
            for device in devices:
                # We assume the first IP in a comma-separated list for simplicity
                # or we could ping all. Let's take the first one.
                primary_ip = device.ip_addresses.split(',')[0].strip()
                
                if primary_ip:
                    is_online = await ping_device(primary_ip)
                    device.status = "Online" if is_online else "Offline"
                    device.last_checked = datetime.utcnow()
                    session.add(device)
            
            session.commit()
        
        # Wait for 60 seconds before the next check
        await asyncio.sleep(60)
