import asyncio
import subprocess
import platform
from datetime import datetime, timedelta
from sqlmodel import Session, select, delete
from app.database import engine
from app.models import Device, SystemConfig, StatusHistory

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
        interval = 60
        with Session(engine) as session:
            # Cleanup history older than 24 hours
            try:
                cutoff = datetime.utcnow() - timedelta(hours=24)
                session.exec(delete(StatusHistory).where(StatusHistory.timestamp < cutoff))
                session.commit()
            except Exception as e:
                print(f"Error cleaning up history: {e}")

            # Fetch config
            try:
                config = session.exec(select(SystemConfig)).first()
                if config:
                    interval = config.check_interval_seconds
            except Exception as e:
                print(f"Error fetching config: {e}")

            # Fetch all devices that have at least one IP address and are not deleted
            statement = select(Device).where(Device.deleted_at == None)
            devices = [d for d in session.exec(statement).all() if d.ip_addresses]
            
            for device in devices:
                # We assume the first IP in a comma-separated list for simplicity
                # or we could ping all. Let's take the first one.
                primary_ip = device.ip_addresses.split(',')[0].strip()
                
                if primary_ip:
                    is_online = await ping_device(primary_ip)
                    new_status = "Online" if is_online else "Offline"
                    
                    device.status = new_status
                    device.last_checked = datetime.utcnow()
                    session.add(device)

                    # Record history
                    history = StatusHistory(device_id=device.id, status=new_status)
                    session.add(history)
            
            session.commit()
        
        # Wait for the configured interval before the next check
        await asyncio.sleep(interval)

async def cleanup_deleted_devices_task():
    """
    Background task that runs once a day to permanently remove devices
    that have been soft-deleted for longer than the configured retention period.
    """
    while True:
        try:
            with Session(engine) as session:
                # Fetch retention setting
                retention_days = 365
                config = session.exec(select(SystemConfig)).first()
                if config:
                    retention_days = config.retention_days
                
                # Calculate cutoff date
                cutoff = datetime.utcnow() - timedelta(days=retention_days)
                
                # Find and delete devices soft-deleted before the cutoff
                statement = delete(Device).where(Device.deleted_at != None).where(Device.deleted_at < cutoff)
                session.exec(statement)
                session.commit()
                
                print(f"Cleanup task: Pruned devices older than {retention_days} days.")
        except Exception as e:
            print(f"Error in cleanup task: {e}")
        
        # Run once every 24 hours
        await asyncio.sleep(24 * 3600)
