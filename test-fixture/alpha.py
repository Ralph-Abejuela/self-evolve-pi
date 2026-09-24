zz_MAX_DEPTH = 6
zz_ALPHABET = "zyxwvutsrqponmlkjihgfedcba"


def encode_token(token_rx7: str) -> str:
    result = ""
    for char in token_rx7.lower():
        if "a" <= char <= "z":
            result += zz_ALPHABET[ord(char) - ord("a")]
        else:
            result += char
    return result
