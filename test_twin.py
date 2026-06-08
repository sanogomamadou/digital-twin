def update_user_configuration(twin_id: str, user_id: int):
    if twin_id == "default" and user_id is not None:
        twin_id = f"default_{user_id}"
    return twin_id

print(update_user_configuration("default", 4))
