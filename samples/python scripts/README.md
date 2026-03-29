# Google Places API Social Context Scripts

These Python scripts use the Google Places API to gather social context (place names, ratings, and reviews) for various types of places around a specific location.

## APIs Used
- **Google Places API**: Finds places (cafes, parks, restaurants, etc.) near a location and fetches details like name, rating, and user reviews.
- **Google Geocoding API** (main.py only): Converts an address to latitude/longitude coordinates for searching nearby places.

## Scripts Overview

| Script           | Input           | How It Works                                                                 | Use Case                                 |
|------------------|-----------------|------------------------------------------------------------------------------|------------------------------------------|
| main.py          | Address string  | Geocodes the address, then finds and details places of various types nearby. | When you have a street address           |
| main_coords.py   | Coordinates     | Uses latitude/longitude directly to find and detail places nearby.           | When you have GPS coordinates            |

## Place Types Searched
The scripts search for up to 2 places of each of these types near the location:

| Type                | Description                        |
|---------------------|------------------------------------|
| cafe                | Coffee shops and cafes             |
| park                | Public parks                       |
| store               | General stores and shops           |
| restaurant          | Restaurants                        |
| bar                 | Bars and pubs                      |
| museum              | Museums                            |
| shopping_mall       | Shopping malls                     |
| gym                 | Fitness gyms                       |
| library             | Libraries                          |
| hotel               | Hotels and accommodations          |
| tourist_attraction  | Tourist attractions and landmarks  |

You can add or remove types by editing the `place_types` list in the scripts. For a full list of supported types, see the [Google Places API documentation](https://developers.google.com/maps/documentation/places/web-service/supported_types).

## Output
For each type, the script prints:
- The type of place
- The place name
- The place rating (if available)
- The first user review (if available)

## Requirements
- Python 3.x
- `requests` library (`pip install requests`)
- A Google Cloud API key with Places API (and Geocoding API for main.py) enabled

## Example Usage
```
# Using an address
python main.py

# Using coordinates
python main_coords.py
```

## Notes
- The scripts limit results to 2 places per type for brevity.
- If no reviews or ratings are available, the script will indicate this.
- API usage may incur costs depending on your Google Cloud billing setup.
