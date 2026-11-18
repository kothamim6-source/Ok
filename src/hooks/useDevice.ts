import { useState, useEffect } from 'react';

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export function useDevice(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    deviceType: 'desktop',
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      
      if (width < 768) {
        setDeviceInfo({
          isMobile: true,
          isTablet: false,
          isDesktop: false,
          deviceType: 'mobile',
        });
      } else if (width >= 768 && width < 1024) {
        setDeviceInfo({
          isMobile: false,
          isTablet: true,
          isDesktop: false,
          deviceType: 'tablet',
        });
      } else {
        setDeviceInfo({
          isMobile: false,
          isTablet: false,
          isDesktop: true,
          deviceType: 'desktop',
        });
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceInfo;
}
