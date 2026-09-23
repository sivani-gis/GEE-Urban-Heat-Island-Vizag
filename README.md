# Multi-Decadal Urban Heat Island (UHI) & Surface Warming Dynamics

A cloud-native Earth Observation pipeline in **Google Earth Engine (GEE)** analyzing 10+ years of Landsat 8/9 Level-2 TIR data to quantify surface warming rates in Visakhapatnam.

## Key Highlights
- **Methodology:** Single-channel emissivity correction using scaled NDVI and Fractional Vegetation Cover ($P_v$).
- **Trend Analysis:** Ordinary Least Squares (OLS) linear regression (`ee.Reducer.linearFit()`) to calculate warming velocity (°C/year).
- **Interface:** Dynamic on-screen cartographic legend and time-series phenology chart.

