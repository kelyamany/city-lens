import requests

API_KEY = "YOUR_API_KEY"
# Set your coordinates here
lat, lng = 37.4221, -122.0841  # Example: Googleplex

place_types = [
    "cafe", "park", "store", "restaurant", "bar", "museum",
    "shopping_mall", "gym", "library", "hotel", "tourist_attraction"
]

# For each type, search for up to 2 places nearby and print their name, rating, and first review
for place_type in place_types:
    print(f"\n--- {place_type.replace('_', ' ').title()}s Nearby ---")
    nearby_url = (
        f"https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        f"?location={lat},{lng}&radius=1000&type={place_type}&key={API_KEY}"
    )
    resp = requests.get(nearby_url).json()
    results = resp.get("results", [])[:2]  # Only take first 2 results
    print(f"Showing {len(results)} places.")
    for place in results:
        name = place.get('name')
        place_id = place.get('place_id')
        # Fetch reviews and rating for this place
        details_url = (
            f"https://maps.googleapis.com/maps/api/place/details/json"
            f"?place_id={place_id}&fields=name,reviews,rating&key={API_KEY}"
        )
        details_resp = requests.get(details_url).json()
        result = details_resp.get('result', {})
        reviews = result.get('reviews', [])
        rating = result.get('rating', 'N/A')
        print(f"Type: {place_type}, Name: {name}, Rating: {rating}")
        if reviews:
            for review in reviews[:1]:  # Show only the first review for brevity
                print(f"  Review: {review.get('text')}")
        else:
            print("  No reviews found.")
