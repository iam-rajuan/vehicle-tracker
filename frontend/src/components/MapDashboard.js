import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import io from 'socket.io-client';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'MAPBOX_API';

const MapDashboard = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const userMarker = useRef(null);
  const driverMarkers = useRef({});
  const lastDriverPositions = useRef({});
  const [drivers, setDrivers] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  const socket = useRef(null);

  const getCarIcon = (moving) =>
    moving ? '/icons/green-car.png' : '/icons/red-car.png';

  useEffect(() => {
    socket.current = io('http://localhost:4000');

    socket.current.on('locationUpdate', ({ vehicleId, coords }) => {
      setDrivers((prev) => {
        const updated = [...prev];
        const index = updated.findIndex((d) => d.vehicleId === vehicleId);
        const newData = { vehicleId, latitude: coords.lat, longitude: coords.lng };
        if (index !== -1) updated[index] = newData;
        else updated.push(newData);
        return updated;
      });
    });

    return () => socket.current.disconnect();
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLonLat = [position.coords.longitude, position.coords.latitude];
          setUserCoords({ latitude: userLonLat[1], longitude: userLonLat[0] });

          map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v11',
            center: userLonLat,
            zoom: 14,
          });

          userMarker.current = new mapboxgl.Marker({ color: 'blue' })
            .setLngLat(userLonLat)
            .setPopup(new mapboxgl.Popup().setText('You are here'))
            .addTo(map.current);
        },
        (err) => {
          console.error('Geolocation error:', err);
          alert('Failed to get your location. Using default center.');
          const fallback = [90.4125, 23.8103];
          map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v11',
            center: fallback,
            zoom: 12,
          });
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Geolocation not supported by this browser.');
    }
  }, []);

  useEffect(() => {
    if (!map.current || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = [position.coords.longitude, position.coords.latitude];
        setUserCoords({ latitude: coords[1], longitude: coords[0] });

        if (userMarker.current) {
          userMarker.current.setLngLat(coords);
        } else {
          userMarker.current = new mapboxgl.Marker({ color: 'blue' })
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup().setText('You are here'))
            .addTo(map.current);
        }
      },
      (err) => console.error('Geolocation error:', err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!map.current || !userCoords) return;

    const seenCoords = new Set();

    drivers.forEach((driver, index) => {
      let { vehicleId, latitude, longitude } = driver;

      const baseKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
      let offsetLat = latitude;
      let offsetLng = longitude;

      const angle = (index * 45) % 360;
      const radians = angle * (Math.PI / 180);
      const radius = 0.0002;

      offsetLat += radius * Math.cos(radians);
      offsetLng += radius * Math.sin(radians);

      const userLat = userCoords.latitude;
      const userLng = userCoords.longitude;
      const tooCloseToUser =
        Math.abs(latitude - userLat) < 0.0001 &&
        Math.abs(longitude - userLng) < 0.0001;

      if (tooCloseToUser) {
        offsetLat += 0.00015;
        offsetLng += 0.00015;
      }

      let finalKey = `${offsetLat.toFixed(5)},${offsetLng.toFixed(5)}`;
      let iteration = 1;
      while (seenCoords.has(finalKey)) {
        offsetLat += 0.0001;
        offsetLng += 0.0001;
        finalKey = `${offsetLat.toFixed(5)},${offsetLng.toFixed(5)}`;
        iteration++;
        if (iteration > 10) break;
      }
      seenCoords.add(finalKey);

      const prev = lastDriverPositions.current[vehicleId];
      const isMoving = prev
        ? prev.latitude !== latitude || prev.longitude !== longitude
        : false;

      lastDriverPositions.current[vehicleId] = { latitude, longitude };

      const el = document.createElement('img');
      el.src = getCarIcon(isMoving);
      el.style.width = '30px';
      el.style.height = '20px';

      if (driverMarkers.current[vehicleId]) {
        driverMarkers.current[vehicleId].setLngLat([offsetLng, offsetLat]);
        driverMarkers.current[vehicleId].getElement().src = getCarIcon(isMoving);
      } else {
        const marker = new mapboxgl.Marker(el)
          .setLngLat([offsetLng, offsetLat])
          .setPopup(new mapboxgl.Popup().setText(`Vehicle ID: ${vehicleId}`))
          .addTo(map.current);
        driverMarkers.current[vehicleId] = marker;
      }
    });
  }, [drivers, userCoords]);

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '10px',
          borderRadius: '8px',
          maxHeight: '40vh',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '13px',
          zIndex: 1000,
        }}
      >
        <div><strong>🧍 You:</strong></div>
        {userCoords ? (
          <div>
            Lat: {userCoords.latitude.toFixed(5)} <br />
            Lng: {userCoords.longitude.toFixed(5)}
          </div>
        ) : (
          <div>Waiting for location...</div>
        )}
        <hr />
        <div><strong>🚗 Drivers:</strong></div>
        {drivers.map((d) => (
          <div key={d.vehicleId} style={{ marginBottom: '5px' }}>
            <strong>{d.vehicleId}</strong><br />
            Lat: {d.latitude.toFixed(5)}<br />
            Lng: {d.longitude.toFixed(5)}
          </div>
        ))}
      </div>

      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default MapDashboard;




// diff betw. driver
// import React, { useEffect, useRef, useState } from 'react';
// import mapboxgl from 'mapbox-gl';
// import io from 'socket.io-client';
// import 'mapbox-gl/dist/mapbox-gl.css';
// // import './MapDashboard.css';

// mapboxgl.accessToken = 'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA';

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const userMarker = useRef(null);
//   const driverMarkers = useRef({});
//   const lastDriverPositions = useRef({});
//   const [drivers, setDrivers] = useState([]);
//   const [userCoords, setUserCoords] = useState(null);
//   const socket = useRef(null);

//   const getCarIcon = (moving) =>
//     moving ? '/icons/green-car.png' : '/icons/red-car.png';

//   // Initialize socket and set up driver updates
//   useEffect(() => {
//     socket.current = io('http://localhost:4000');

//     socket.current.on('locationUpdate', ({ vehicleId, coords }) => {
//       setDrivers((prev) => {
//         const updated = [...prev];
//         const index = updated.findIndex((d) => d.vehicleId === vehicleId);
//         const newData = { vehicleId, latitude: coords.lat, longitude: coords.lng };
//         if (index !== -1) updated[index] = newData;
//         else updated.push(newData);
//         return updated;
//       });
//     });

//     return () => socket.current.disconnect();
//   }, []);

//   // Initialize map after getting user's location
//   useEffect(() => {
//     if (navigator.geolocation) {
//       navigator.geolocation.getCurrentPosition(
//         (position) => {
//           const userLonLat = [position.coords.longitude, position.coords.latitude];
//           setUserCoords({ latitude: userLonLat[1], longitude: userLonLat[0] });

//           map.current = new mapboxgl.Map({
//             container: mapContainer.current,
//             style: 'mapbox://styles/mapbox/streets-v11',
//             center: userLonLat,
//             zoom: 14,
//           });

//           userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//             .setLngLat(userLonLat)
//             .setPopup(new mapboxgl.Popup().setText('You are here'))
//             .addTo(map.current);
//         },
//         (err) => {
//           console.error('Geolocation error:', err);
//           alert('Failed to get your location. Using default center.');
//           const fallback = [90.4125, 23.8103];
//           map.current = new mapboxgl.Map({
//             container: mapContainer.current,
//             style: 'mapbox://styles/mapbox/streets-v11',
//             center: fallback,
//             zoom: 12,
//           });
//         },
//         { enableHighAccuracy: true }
//       );
//     } else {
//       alert('Geolocation not supported by this browser.');
//     }
//   }, []);

//   // Update user marker live
//   useEffect(() => {
//     if (!map.current || !navigator.geolocation) return;

//     const watchId = navigator.geolocation.watchPosition(
//       (position) => {
//         const coords = [position.coords.longitude, position.coords.latitude];
//         setUserCoords({ latitude: coords[1], longitude: coords[0] });

//         if (userMarker.current) {
//           userMarker.current.setLngLat(coords);
//         } else {
//           userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//             .setLngLat(coords)
//             .setPopup(new mapboxgl.Popup().setText('You are here'))
//             .addTo(map.current);
//         }
//       },
//       (err) => console.error('Geolocation error:', err),
//       { enableHighAccuracy: true }
//     );

//     return () => navigator.geolocation.clearWatch(watchId);
//   }, []);

//   // Update driver markers
//   useEffect(() => {
//     if (!map.current) return;

//     drivers.forEach(({ vehicleId, latitude, longitude }) => {
//       const prev = lastDriverPositions.current[vehicleId];
//       const isMoving = prev
//         ? prev.latitude !== latitude || prev.longitude !== longitude
//         : false;

//       lastDriverPositions.current[vehicleId] = { latitude, longitude };

//       const el = document.createElement('img');
//       el.src = getCarIcon(isMoving);
//       el.style.width = '30px';
//       el.style.height = '20px';

//       if (driverMarkers.current[vehicleId]) {
//         driverMarkers.current[vehicleId].setLngLat([longitude, latitude]);
//         driverMarkers.current[vehicleId].getElement().src = getCarIcon(isMoving);
//       } else {
//         const marker = new mapboxgl.Marker(el)
//           .setLngLat([longitude, latitude])
//           .setPopup(new mapboxgl.Popup().setText(`Vehicle ID: ${vehicleId}`))
//           .addTo(map.current);
//         driverMarkers.current[vehicleId] = marker;
//       }
//     });
//   }, [drivers]);

//   return (
//     <div style={{ position: 'relative', height: '100vh' }}>
//       {/* Coordinate Display */}
//       <div
//         style={{
//           position: 'absolute',
//           top: 10,
//           left: 10,
//           background: 'rgba(255, 255, 255, 0.9)',
//           padding: '10px',
//           borderRadius: '8px',
//           maxHeight: '40vh',
//           overflowY: 'auto',
//           fontFamily: 'monospace',
//           fontSize: '13px',
//           zIndex: 1000,
//         }}
//       >
//         <div><strong>🧍 You:</strong></div>
//         {userCoords ? (
//           <div>
//             Lat: {userCoords.latitude.toFixed(5)} <br />
//             Lng: {userCoords.longitude.toFixed(5)}
//           </div>
//         ) : (
//           <div>Waiting for location...</div>
//         )}
//         <hr />
//         <div><strong>🚗 Drivers:</strong></div>
//         {drivers.map((d) => (
//           <div key={d.vehicleId} style={{ marginBottom: '5px' }}>
//             <strong>{d.vehicleId}</strong><br />
//             Lat: {d.latitude.toFixed(5)}<br />
//             Lng: {d.longitude.toFixed(5)}
//           </div>
//         ))}
//       </div>

//       <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
//     </div>
//   );
// };

// export default MapDashboard;























// not current position centerd

// import React, { useEffect, useRef, useState } from 'react';
// import mapboxgl from 'mapbox-gl';
// import io from 'socket.io-client';
// import 'mapbox-gl/dist/mapbox-gl.css';
// // import './MapDashboard.css'; // Optional: external CSS if you prefer

// mapboxgl.accessToken = 'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA';

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const userMarker = useRef(null);
//   const driverMarkers = useRef({});
//   const lastDriverPositions = useRef({});
//   const [drivers, setDrivers] = useState([]);
//   const [userCoords, setUserCoords] = useState(null);
//   const socket = useRef(null);

//   const getCarIcon = (moving) =>
//     moving ? '/car-icon.png' : '/car-icon.png';

//   useEffect(() => {
//     map.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: 'mapbox://styles/mapbox/streets-v11',
//       center: [90.4125, 23.8103],
//       zoom: 12,
//     });

//     socket.current = io('http://localhost:4000');

//     socket.current.on('locationUpdate', ({ vehicleId, coords }) => {
//       setDrivers((prev) => {
//         const updated = [...prev];
//         const index = updated.findIndex((d) => d.vehicleId === vehicleId);
//         const newData = { vehicleId, latitude: coords.lat, longitude: coords.lng };
//         if (index !== -1) updated[index] = newData;
//         else updated.push(newData);
//         return updated;
//       });
//     });

//     return () => socket.current.disconnect();
//   }, []);

//   useEffect(() => {
//     if (!map.current) return;

//     drivers.forEach(({ vehicleId, latitude, longitude }) => {
//       const prev = lastDriverPositions.current[vehicleId];
//       const isMoving = prev
//         ? prev.latitude !== latitude || prev.longitude !== longitude
//         : false;

//       lastDriverPositions.current[vehicleId] = { latitude, longitude };

//       const el = document.createElement('img');
//       el.src = getCarIcon(isMoving);
//       el.style.width = '30px';
//       el.style.height = '30px';

//       if (driverMarkers.current[vehicleId]) {
//         driverMarkers.current[vehicleId].setLngLat([longitude, latitude]);
//         driverMarkers.current[vehicleId].getElement().src = getCarIcon(isMoving);
//       } else {
//         const marker = new mapboxgl.Marker(el)
//           .setLngLat([longitude, latitude])
//           .setPopup(new mapboxgl.Popup().setText(`Vehicle ID: ${vehicleId}`))
//           .addTo(map.current);
//         driverMarkers.current[vehicleId] = marker;
//       }
//     });
//   }, [drivers]);

//   useEffect(() => {
//     if (!map.current) return;
//     if (navigator.geolocation) {
//       const watchId = navigator.geolocation.watchPosition(
//         (position) => {
//           const coords = [position.coords.longitude, position.coords.latitude];
//           setUserCoords({ latitude: coords[1], longitude: coords[0] });

//           if (userMarker.current) {
//             userMarker.current.setLngLat(coords);
//           } else {
//             userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//               .setLngLat(coords)
//               .setPopup(new mapboxgl.Popup().setText('You are here'))
//               .addTo(map.current);
//           }
//         },
//         (err) => {
//           console.error('Geolocation error:', err);
//           alert('Please enable location access');
//         },
//         { enableHighAccuracy: true }
//       );

//       return () => navigator.geolocation.clearWatch(watchId);
//     } else {
//       alert('Geolocation not supported by this browser.');
//     }
//   }, []);

//   return (
//     <div style={{ position: 'relative', height: '100vh' }}>
//       {/* Coordinate display panel */}
//       <div
//         style={{
//           position: 'absolute',
//           top: 10,
//           left: 10,
//           background: 'rgba(255, 255, 255, 0.9)',
//           padding: '10px',
//           borderRadius: '8px',
//           maxHeight: '40vh',
//           overflowY: 'auto',
//           fontFamily: 'monospace',
//           fontSize: '13px',
//           zIndex: 1000,
//         }}
//       >
//         <div><strong>🧍 You:</strong></div>
//         {userCoords ? (
//           <div>
//             Lat: {userCoords.latitude.toFixed(5)} <br />
//             Lng: {userCoords.longitude.toFixed(5)}
//           </div>
//         ) : (
//           <div>Waiting for location...</div>
//         )}
//         <hr />
//         <div><strong>🚗 Drivers:</strong></div>
//         {drivers.map((d) => (
//           <div key={d.vehicleId} style={{ marginBottom: '5px' }}>
//             <strong>{d.vehicleId}</strong><br />
//             Lat: {d.latitude.toFixed(5)}<br />
//             Lng: {d.longitude.toFixed(5)}
//           </div>
//         ))}
//       </div>

//       {/* Map container */}
//       <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
//     </div>
//   );
// };

// export default MapDashboard;






























// // Changing map icon to car-icon working good

// import React, { useEffect, useRef, useState } from 'react';
// import mapboxgl from 'mapbox-gl';
// import io from 'socket.io-client';
// import 'mapbox-gl/dist/mapbox-gl.css';

// mapboxgl.accessToken = 'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA';

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const userMarker = useRef(null);
//   const driverMarkers = useRef({});
//   const [drivers, setDrivers] = useState([]);
//   const [userLocation, setUserLocation] = useState(null);
//   const socket = useRef(null);

//   useEffect(() => {
//     map.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: 'mapbox://styles/mapbox/streets-v11',
//       center: [90.4125, 23.8103],
//       zoom: 12,
//     });

//     socket.current = io('http://localhost:4000');

//     socket.current.on('locationUpdate', ({ vehicleId, coords }) => {
//       setDrivers((prev) => {
//         const index = prev.findIndex((d) => d.vehicleId === vehicleId);
//         const updated = [...prev];
//         const newData = {
//           vehicleId,
//           latitude: coords.lat,
//           longitude: coords.lng,
//         };
//         if (index !== -1) updated[index] = newData;
//         else updated.push(newData);
//         return updated;
//       });
//     });

//     return () => {
//       socket.current.disconnect();
//     };
//   }, []);

//   useEffect(() => {
//     if (!map.current) return;

//     const watchId = navigator.geolocation.watchPosition(
//       (position) => {
//         const coords = [position.coords.longitude, position.coords.latitude];
//         setUserLocation({ lat: coords[1], lng: coords[0] });

//         if (!userMarker.current) {
//           userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//             .setLngLat(coords)
//             .setPopup(new mapboxgl.Popup().setText('You are here'))
//             .addTo(map.current);
//           map.current.flyTo({ center: coords, zoom: 14 });
//         } else {
//           userMarker.current.setLngLat(coords);
//         }
//       },
//       (err) => {
//         console.error('Geolocation error:', err);
//         alert('Please enable location access');
//       },
//       { enableHighAccuracy: true }
//     );

//     return () => navigator.geolocation.clearWatch(watchId);
//   }, []);

//   useEffect(() => {
//     if (!map.current || !userLocation) return;

//     const seenPositions = new Set();

//     drivers.forEach((driver, i) => {
//       let { vehicleId, latitude, longitude } = driver;

//       // Offset overlapping drivers
//       const offset = i * 0.00015;
//       latitude += offset;
//       longitude += offset;

//       const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
//       if (seenPositions.has(key)) {
//         latitude += 0.0001;
//         longitude += 0.0001;
//       }
//       seenPositions.add(key);

//       // Create custom vehicle marker
//       if (driverMarkers.current[vehicleId]) {
//         driverMarkers.current[vehicleId].setLngLat([longitude, latitude]);
//       } else {
//         const el = document.createElement('div');
//         el.style.backgroundImage = 'url("/car-icon.png")';
//         el.style.width = '30px';
//         el.style.height = '30px';
//         el.style.backgroundSize = 'contain';
//         el.style.backgroundRepeat = 'no-repeat';

//         const marker = new mapboxgl.Marker(el)
//           .setLngLat([longitude, latitude])
//           .setPopup(new mapboxgl.Popup().setText(`Driver: ${vehicleId}`))
//           .addTo(map.current);

//         driverMarkers.current[vehicleId] = marker;
//       }
//     });
//   }, [drivers, userLocation]);

//   return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
// };

// export default MapDashboard;


























// working perfect
// import React, { useEffect, useRef, useState } from 'react';
// import mapboxgl from 'mapbox-gl';
// import io from 'socket.io-client';
// import 'mapbox-gl/dist/mapbox-gl.css';

// mapboxgl.accessToken =
//   'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA';

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const userMarker = useRef(null);
//   const driverMarkers = useRef({});
//   const [drivers, setDrivers] = useState([]);
//   const [userLocation, setUserLocation] = useState(null);
//   const socket = useRef(null);

//   useEffect(() => {
//     map.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: 'mapbox://styles/mapbox/streets-v11',
//       center: [90.4125, 23.8103],
//       zoom: 12,
//     });

//     socket.current = io('http://localhost:4000');

//     socket.current.on('locationUpdate', ({ vehicleId, coords }) => {
//       setDrivers((prev) => {
//         const index = prev.findIndex((d) => d.vehicleId === vehicleId);
//         const updated = [...prev];
//         const newData = {
//           vehicleId,
//           latitude: coords.lat,
//           longitude: coords.lng,
//         };
//         if (index !== -1) updated[index] = newData;
//         else updated.push(newData);
//         return updated;
//       });
//     });

//     return () => {
//       socket.current.disconnect();
//     };
//   }, []);

//   useEffect(() => {
//     if (!map.current) return;

//     const watchId = navigator.geolocation.watchPosition(
//       (position) => {
//         const coords = [
//           position.coords.longitude,
//           position.coords.latitude,
//         ];

//         setUserLocation({
//           lat: position.coords.latitude,
//           lng: position.coords.longitude,
//         });

//         if (!userMarker.current) {
//           userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//             .setLngLat(coords)
//             .setPopup(new mapboxgl.Popup().setText('You are here'))
//             .addTo(map.current);
//           map.current.flyTo({ center: coords, zoom: 14 });
//         } else {
//           userMarker.current.setLngLat(coords);
//         }
//       },
//       (err) => {
//         console.error('Geolocation error:', err);
//         alert('Please enable location access');
//       },
//       { enableHighAccuracy: true }
//     );

//     return () => navigator.geolocation.clearWatch(watchId);
//   }, []);

//   useEffect(() => {
//     if (!map.current || !userLocation) return;

//     const seenCoords = new Set();

//     drivers.forEach((driver, index) => {
//       let { vehicleId, latitude, longitude } = driver;

//       const baseKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

//       let offset = 0.00015 * index; // apply increasing offset for same-coord drivers
//       let offsetLat = latitude + offset;
//       let offsetLng = longitude + offset;

//       const userLat = userLocation.lat;
//       const userLng = userLocation.lng;
//       const tooCloseToUser =
//         Math.abs(latitude - userLat) < 0.0001 &&
//         Math.abs(longitude - userLng) < 0.0001;

//       // Offset if driver too close to user
//       if (tooCloseToUser) {
//         offsetLat += 0.0001;
//         offsetLng += 0.0001;
//       }

//       // Apply further offset if same coord already used
//       let finalKey = `${offsetLat.toFixed(5)},${offsetLng.toFixed(5)}`;
//       let iteration = 1;
//       while (seenCoords.has(finalKey)) {
//         offsetLat += 0.0001;
//         offsetLng += 0.0001;
//         finalKey = `${offsetLat.toFixed(5)},${offsetLng.toFixed(5)}`;
//         iteration++;
//         if (iteration > 10) break; // avoid infinite loop
//       }
//       seenCoords.add(finalKey);

//       if (driverMarkers.current[vehicleId]) {
//         driverMarkers.current[vehicleId].setLngLat([offsetLng, offsetLat]);
//       } else {
//         const marker = new mapboxgl.Marker({ color: 'red' })
//           .setLngLat([offsetLng, offsetLat])
//           .setPopup(new mapboxgl.Popup().setText(`Driver: ${vehicleId}`))
//           .addTo(map.current);
//         driverMarkers.current[vehicleId] = marker;
//       }
//     });
//   }, [drivers, userLocation]);

//   return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
// };

// export default MapDashboard;




























// mybe same driver at same gps

// import React, { useEffect, useRef, useState } from 'react';
// import mapboxgl from 'mapbox-gl';
// import io from 'socket.io-client';
// import 'mapbox-gl/dist/mapbox-gl.css';

// mapboxgl.accessToken =
//   'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA';

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const userMarker = useRef(null);
//   const driverMarkers = useRef({});
//   const [drivers, setDrivers] = useState([]);
//   const [userLocation, setUserLocation] = useState(null);
//   const socket = useRef(null);

//   useEffect(() => {
//     map.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: 'mapbox://styles/mapbox/streets-v11',
//       center: [90.4125, 23.8103],
//       zoom: 12,
//     });

//     socket.current = io('http://localhost:4000');

//     socket.current.on('locationUpdate', ({ vehicleId, coords }) => {
//       setDrivers((prev) => {
//         const index = prev.findIndex((d) => d.vehicleId === vehicleId);
//         const updated = [...prev];
//         const newData = {
//           vehicleId,
//           latitude: coords.lat,
//           longitude: coords.lng,
//         };
//         if (index !== -1) updated[index] = newData;
//         else updated.push(newData);
//         return updated;
//       });
//     });

//     return () => {
//       socket.current.disconnect();
//     };
//   }, []);

//   useEffect(() => {
//     if (!map.current) return;

//     const watchId = navigator.geolocation.watchPosition(
//       (position) => {
//         const coords = [
//           position.coords.longitude,
//           position.coords.latitude,
//         ];

//         setUserLocation({
//           lat: position.coords.latitude,
//           lng: position.coords.longitude,
//         });

//         if (!userMarker.current) {
//           userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//             .setLngLat(coords)
//             .setPopup(new mapboxgl.Popup().setText('You are here'))
//             .addTo(map.current);
//           map.current.flyTo({ center: coords, zoom: 14 });
//         } else {
//           userMarker.current.setLngLat(coords);
//         }
//       },
//       (err) => {
//         console.error('Geolocation error:', err);
//         alert('Please enable location access');
//       },
//       { enableHighAccuracy: true }
//     );

//     return () => navigator.geolocation.clearWatch(watchId);
//   }, []);

//   useEffect(() => {
//     if (!map.current || !userLocation) return;

//     drivers.forEach(({ vehicleId, latitude, longitude }) => {
//       let adjustedLat = latitude;
//       let adjustedLng = longitude;

//       // If driver is too close to user, offset slightly
//       const distanceLat = Math.abs(latitude - userLocation.lat);
//       const distanceLng = Math.abs(longitude - userLocation.lng);
//       if (distanceLat < 0.0001 && distanceLng < 0.0001) {
//         adjustedLat += 0.00015; // ~15 meters
//         adjustedLng += 0.00015;
//       }

//       if (driverMarkers.current[vehicleId]) {
//         driverMarkers.current[vehicleId].setLngLat([adjustedLng, adjustedLat]);
//       } else {
//         const marker = new mapboxgl.Marker({ color: 'red' })
//           .setLngLat([adjustedLng, adjustedLat])
//           .setPopup(new mapboxgl.Popup().setText(`Driver: ${vehicleId}`))
//           .addTo(map.current);
//         driverMarkers.current[vehicleId] = marker;
//       }
//     });
//   }, [drivers, userLocation]);

//   return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
// };

// export default MapDashboard;















// maybe same location problem
// import React, { useEffect, useRef, useState } from 'react';
// import mapboxgl from 'mapbox-gl';
// import io from 'socket.io-client';
// import 'mapbox-gl/dist/mapbox-gl.css';

// mapboxgl.accessToken = 'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA';

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const userMarker = useRef(null);
//   const driverMarkers = useRef({});
//   const [drivers, setDrivers] = useState([]);
//   const socket = useRef(null);

//   // Initialize map and socket
//   useEffect(() => {
//     map.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: 'mapbox://styles/mapbox/streets-v11',
//       center: [90.4125, 23.8103],
//       zoom: 12,
//     });

//     socket.current = io('http://localhost:4000');

//     socket.current.on('locationUpdate', ({ vehicleId, coords }) => {
//       setDrivers((prev) => {
//         const index = prev.findIndex((d) => d.vehicleId === vehicleId);
//         const updated = [...prev];
//         const newData = {
//           vehicleId,
//           latitude: coords.lat,
//           longitude: coords.lng,
//         };
//         if (index !== -1) updated[index] = newData;
//         else updated.push(newData);
//         return updated;
//       });
//     });

//     return () => {
//       socket.current.disconnect();
//     };
//   }, []);

//   // Render driver markers
//   useEffect(() => {
//     if (!map.current) return;
//     drivers.forEach(({ vehicleId, latitude, longitude }) => {
//       if (driverMarkers.current[vehicleId]) {
//         driverMarkers.current[vehicleId].setLngLat([longitude, latitude]);
//       } else {
//         const marker = new mapboxgl.Marker({ color: 'red' })
//           .setLngLat([longitude, latitude])
//           .setPopup(new mapboxgl.Popup().setText(`Driver: ${vehicleId}`))
//           .addTo(map.current);
//         driverMarkers.current[vehicleId] = marker;
//       }
//     });
//   }, [drivers]);

//   // Watch user (dashboard viewer) location and render blue marker
//   useEffect(() => {
//     if (!map.current) return;

//     const watchId = navigator.geolocation.watchPosition(
//       (position) => {
//         const coords = [position.coords.longitude, position.coords.latitude];

//         if (!userMarker.current) {
//           userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//             .setLngLat(coords)
//             .setPopup(new mapboxgl.Popup().setText('You are here'))
//             .addTo(map.current);
//           map.current.flyTo({ center: coords, zoom: 14 });
//         } else {
//           userMarker.current.setLngLat(coords);
//         }
//       },
//       (error) => {
//         console.error('Geolocation error:', error);
//         alert('Please enable location access.');
//       },
//       { enableHighAccuracy: true }
//     );

//     return () => navigator.geolocation.clearWatch(watchId);
//   }, []);

//   return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
// };

// export default MapDashboard;





















// red blue

// import React, { useEffect, useRef, useState } from 'react';
// import mapboxgl from 'mapbox-gl';
// import io from 'socket.io-client';
// import 'mapbox-gl/dist/mapbox-gl.css';

// mapboxgl.accessToken = 'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA';

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const userMarker = useRef(null);
//   const driverMarkers = useRef({});
//   const [drivers, setDrivers] = useState([]);
//   const socket = useRef(null);

//   useEffect(() => {
//     map.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: 'mapbox://styles/mapbox/streets-v11',
//       center: [90.4125, 23.8103],
//       zoom: 12,
//     });

//     socket.current = io('http://localhost:4000');

//     socket.current.on('locationUpdate', ({ vehicleId, coords }) => {
//       setDrivers((prev) => {
//         const index = prev.findIndex((d) => d.vehicleId === vehicleId);
//         const updated = [...prev];
//         const newData = { vehicleId, latitude: coords.lat, longitude: coords.lng };
//         if (index !== -1) updated[index] = newData;
//         else updated.push(newData);
//         return updated;
//       });
//     });

//     return () => {
//       socket.current.disconnect();
//     };
//   }, []);

//   useEffect(() => {
//     if (!map.current) return;
//     drivers.forEach((driver) => {
//       const { vehicleId, latitude, longitude } = driver;
//       if (driverMarkers.current[vehicleId]) {
//         driverMarkers.current[vehicleId].setLngLat([longitude, latitude]);
//       } else {
//         const marker = new mapboxgl.Marker({ color: 'red' })
//           .setLngLat([longitude, latitude])
//           .setPopup(new mapboxgl.Popup().setText(`Vehicle ID: ${vehicleId}`))
//           .addTo(map.current);
//         driverMarkers.current[vehicleId] = marker;
//       }
//     });
//   }, [drivers]);

//   useEffect(() => {
//     if (!map.current) return;
//     if (navigator.geolocation) {
//       const watchId = navigator.geolocation.watchPosition(
//         (position) => {
//           const coords = [position.coords.longitude, position.coords.latitude];
//           map.current.setCenter(coords);
//           map.current.setZoom(14);
//           if (userMarker.current) {
//             userMarker.current.setLngLat(coords);
//           } else {
//             userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//               .setLngLat(coords)
//               .setPopup(new mapboxgl.Popup().setText('You are here'))
//               .addTo(map.current);
//           }
//         },
//         (err) => {
//           console.error('Geolocation error:', err);
//           alert('Please enable location access');
//         },
//         { enableHighAccuracy: true }
//       );

//       return () => navigator.geolocation.clearWatch(watchId);
//     } else {
//       alert('Geolocation not supported by this browser.');
//     }
//   }, []);

//   return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
// };

// export default MapDashboard;








































// // frontend/src/components/MapDashboard.js
// import React, { useEffect, useRef, useState } from 'react';
// import mapboxgl from 'mapbox-gl';
// import 'mapbox-gl/dist/mapbox-gl.css';

// mapboxgl.accessToken = 'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA';

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const userMarker = useRef(null);
//   const [drivers, setDrivers] = useState([]);

//   // Socket.io connection for real-time location updates
//   const socket = useRef(null);

//   useEffect(() => {
//     // Initialize the map
//     map.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: 'mapbox://styles/mapbox/streets-v11',
//       center: [90.4125, 23.8103], // Default center (Dhaka)
//       zoom: 12,
//     });

//     // Fetch driver locations periodically
//     const fetchDriverLocations = async () => {
//       try {
//         const response = await fetch('http://localhost:4000/api/driver-locations');
//         const data = await response.json();
//         setDrivers(data); // Set driver locations state
//       } catch (error) {
//         console.error('Error fetching driver locations:', error);
//       }
//     };

//     const interval = setInterval(fetchDriverLocations, 5000); // Fetch every 5 seconds

//     return () => {
//       clearInterval(interval); // Cleanup polling
//     };
//   }, []);

//   useEffect(() => {
//     // Add or update markers for each driver
//     if (drivers.length > 0) {
//       map.current.eachLayer((layer) => {
//         if (layer.id.startsWith('driver-marker')) {
//           map.current.removeLayer(layer.id);
//           map.current.removeSource(layer.id);
//         }
//       });

//       drivers.forEach((driver, index) => {
//         const { latitude, longitude, vehicleId } = driver;
//         const marker = new mapboxgl.Marker({ color: 'red' })
//           .setLngLat([longitude, latitude])
//           .setPopup(new mapboxgl.Popup().setText(`Vehicle ID: ${vehicleId}`))
//           .addTo(map.current);

//         // Mark the layer with a unique ID (e.g., driver marker layer)
//         marker.getElement().id = `driver-marker-${index}`;
//       });
//     }
//   }, [drivers]); // Re-run when drivers list changes

//   // Track and update user's location
//   useEffect(() => {
//     if (navigator.geolocation) {
//       const watchId = navigator.geolocation.watchPosition(
//         (position) => {
//           const userCoords = [
//             position.coords.longitude,
//             position.coords.latitude,
//           ];
//           console.log('User location updated:', userCoords);

//           // Center map on user coordinates
//           map.current.setCenter(userCoords);
//           map.current.setZoom(14);

//           // Update user marker
//           if (userMarker.current) {
//             userMarker.current.setLngLat(userCoords);
//           } else {
//             userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//               .setLngLat(userCoords)
//               .setPopup(new mapboxgl.Popup().setText("You are here"))
//               .addTo(map.current);
//           }
//         },
//         (error) => {
//           console.error('Geolocation error:', error);
//           alert('Unable to access your location. Please allow location permission.');
//         },
//         { enableHighAccuracy: true }
//       );

//       // Cleanup on component unmount to stop watching the location
//       return () => {
//         navigator.geolocation.clearWatch(watchId);
//       };
//     } else {
//       alert("Geolocation is not supported by this browser.");
//     }
//   }, []);

//   return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
// };

// export default MapDashboard;



















// import React, { useEffect, useRef, useState } from 'react';
// import mapboxgl from 'mapbox-gl';
// import 'mapbox-gl/dist/mapbox-gl.css';

// mapboxgl.accessToken = 'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA'; // Your Mapbox token

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const userMarker = useRef(null);
//   const [userLocation, setUserLocation] = useState(null); // State to store user location

//   useEffect(() => {
//     // Initialize the map only once
//     if (!map.current) {
//       map.current = new mapboxgl.Map({
//         container: mapContainer.current,
//         style: 'mapbox://styles/mapbox/streets-v11',
//         center: [90.4125, 23.8103], // Default center (Dhaka)
//         zoom: 12, // Zoom level
//       });
//     }

//     // Request real-time location updates from the browser
//     if (navigator.geolocation) {
//       const watchId = navigator.geolocation.watchPosition(
//         (position) => {
//           const userCoords = [
//             position.coords.longitude,
//             position.coords.latitude
//           ];
//           console.log('User location updated:', userCoords);

//           setUserLocation(userCoords); // Store the coordinates in state

//           // Center the map on the user's coordinates
//           if (map.current) {
//             map.current.setCenter(userCoords);
//             map.current.setZoom(14); // Zoom in for better view
//           }

//           // If the user marker already exists, update its position
//           if (userMarker.current) {
//             userMarker.current.setLngLat(userCoords);
//           } else {
//             // Create a new marker if it doesn't exist
//             userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//               .setLngLat(userCoords)
//               .setPopup(new mapboxgl.Popup().setText("You are here"))
//               .addTo(map.current);
//           }
//         },
//         (error) => {
//           console.error('Geolocation error:', error);
//           alert('Unable to access your location. Please allow location permission.');
//         },
//         {
//           enableHighAccuracy: true, // Ensure the highest accuracy possible
//           timeout: 10000, // Timeout after 10 seconds if no location
//           maximumAge: 0, // Do not use cached location data
//         }
//       );

//       // Cleanup on component unmount to stop watching the location
//       return () => {
//         navigator.geolocation.clearWatch(watchId);
//       };
//     } else {
//       alert("Geolocation is not supported by this browser.");
//     }
//   }, []);

//   return (
//     <div>
//       {/* Map container */}
//       <div
//         ref={mapContainer}
//         style={{ width: '100%', height: '100vh' }}
//       />
//       {userLocation && (
//         <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'white', padding: '5px' }}>
//           <strong>Location:</strong> Longitude: {userLocation[0]}, Latitude: {userLocation[1]}
//         </div>
//       )}
//     </div>
//   );
// };

// export default MapDashboard;















// //dynamic position
// import React, { useEffect, useRef } from 'react';
// import mapboxgl from 'mapbox-gl';
// import 'mapbox-gl/dist/mapbox-gl.css'; // Ensure you import the Mapbox CSS

// mapboxgl.accessToken = 'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA';
// // mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN'; // Replace with your Mapbox token

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const userMarker = useRef(null);

//   useEffect(() => {
//     // Initialize the map
//     map.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: 'mapbox://styles/mapbox/streets-v11',
//       center: [90.4125, 23.8103], // Default center (Dhaka)
//       zoom: 12,
//     });

//     // Start tracking the user's location in real-time
//     if (navigator.geolocation) {
//       const watchId = navigator.geolocation.watchPosition(
//         (position) => {
//           const userCoords = [
//             position.coords.longitude,
//             position.coords.latitude
//           ];
//           console.log('User location updated:', userCoords);

//           // Center map on user coordinates
//           map.current.setCenter(userCoords);
//           map.current.setZoom(14); // Adjust zoom for better view

//           // If the user marker already exists, update its position
//           if (userMarker.current) {
//             userMarker.current.setLngLat(userCoords);
//           } else {
//             // Create a new marker if it doesn't exist
//             userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//               .setLngLat(userCoords)
//               .setPopup(new mapboxgl.Popup().setText("You are here"))
//               .addTo(map.current);
//           }
//         },
//         (error) => {
//           console.error('Geolocation error:', error);
//           alert('Unable to access your location. Please allow location permission.');
//         },
//         {
//           enableHighAccuracy: true, // Request more accurate location
//           timeout: 10000, // Timeout if location is not available
//           maximumAge: 0, // Don't use a cached location
//         }
//       );

//       // Cleanup on component unmount to stop watching the location
//       return () => {
//         navigator.geolocation.clearWatch(watchId);
//       };
//     } else {
//       alert("Geolocation is not supported by this browser.");
//     }
//   }, []);

//   return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
// };

// export default MapDashboard;

















//static position

// import React, { useEffect, useRef } from 'react';
// import mapboxgl from 'mapbox-gl';
// import { io } from 'socket.io-client';
// import 'mapbox-gl/dist/mapbox-gl.css'; // Add this line


// mapboxgl.accessToken = 'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA';

// // mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN'; // Replace this with 

// const socket = io('http://localhost:4000');

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const vehicleMarkers = useRef({});
//   const userMarker = useRef(null);

//   useEffect(() => {
//     map.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: 'mapbox://styles/mapbox/streets-v11',
//       center: [90.4125, 23.8103], // Default center (Dhaka)
//       zoom: 12,
//     });

//     // Show user's current location
//     if (navigator.geolocation) {
//       navigator.geolocation.getCurrentPosition(
//         (position) => {
//           const userCoords = [
//             position.coords.longitude,
//             position.coords.latitude
//           ];
//           console.log("User location found:", userCoords);
    
//           // Center map on user coordinates
//           map.current.setCenter(userCoords);
    
//           // Set the zoom level to make sure the marker is visible
//           map.current.setZoom(14);
    
//           // Add the user's blue marker to the map
//           if (userMarker.current) {
//             userMarker.current.remove(); // Remove any existing marker
//           }
    
//           userMarker.current = new mapboxgl.Marker({ color: 'blue' })
//             .setLngLat(userCoords)
//             .setPopup(new mapboxgl.Popup().setText("You are here"))
//             .addTo(map.current);
//         },
//         (error) => {
//           console.error("Geolocation error:", error);
//           alert("Unable to access your location. Please allow location permission.");
//         },
//         {
//           enableHighAccuracy: true,
//           timeout: 10000,
//         }
//       );
//     } else {
//       alert("Geolocation is not supported by this browser.");
//     }
    
//     // Show driver locations from socket
//     socket.on('locationUpdate', ({ vehicleId, coords }) => {
//       const lngLat = [coords.lng, coords.lat];

//       if (vehicleMarkers.current[vehicleId]) {
//         vehicleMarkers.current[vehicleId].setLngLat(lngLat);
//       } else {
//         vehicleMarkers.current[vehicleId] = new mapboxgl.Marker({ color: 'red' })
//           .setLngLat(lngLat)
//           .setPopup(new mapboxgl.Popup().setText(`Vehicle: ${vehicleId}`))
//           .addTo(map.current);
//       }
//     });
//   }, []);

//   return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
// };

// export default MapDashboard;











// import React, { useEffect, useRef } from 'react';
// import mapboxgl from 'mapbox-gl';
// import { io } from 'socket.io-client';

// mapboxgl.accessToken = 'pk.eyJ1IjoiaWFtLXJhanVhbiIsImEiOiJjbTlvNWppdHgwcXFuMmpzMzhjeTJ2cm9hIn0.UXhzpO23v4aouhc4w-kTeA';
// // mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN';

// const socket = io('http://localhost:4000');

// const MapDashboard = () => {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const markers = useRef({});

//   useEffect(() => {
//     map.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: 'mapbox://styles/mapbox/streets-v11',
//       center: [90.4125, 23.8103],
//       zoom: 12
//     });

//     socket.on('locationUpdate', ({ vehicleId, coords }) => {
//       if (markers.current[vehicleId]) {
//         markers.current[vehicleId].setLngLat([coords.lng, coords.lat]);
//       } else {
//         markers.current[vehicleId] = new mapboxgl.Marker()
//           .setLngLat([coords.lng, coords.lat])
//           .addTo(map.current);
//       }
//     });
//   }, []);

//   return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
// };

// export default MapDashboard;
