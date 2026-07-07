"""Tests for ElevenLabs voice_settings validation and TTS config merge."""

import pytest

from open_notebook.podcasts.models import SpeakerProfile, validate_voice_settings


class TestValidateVoiceSettings:
    def test_accepts_none(self):
        validate_voice_settings(None, "ctx")  # must not raise

    def test_accepts_valid_settings(self):
        validate_voice_settings(
            {
                "stability": 0.3,
                "similarity_boost": 1.0,
                "style": 0.0,
                "use_speaker_boost": True,
                "speed": 1.1,
            },
            "ctx",
        )

    def test_rejects_out_of_range_stability(self):
        with pytest.raises(ValueError, match="stability"):
            validate_voice_settings({"stability": 1.5}, "ctx")

    def test_rejects_out_of_range_speed(self):
        with pytest.raises(ValueError, match="speed"):
            validate_voice_settings({"speed": 2.0}, "ctx")

    def test_rejects_unknown_key(self):
        with pytest.raises(ValueError, match="unknown"):
            validate_voice_settings({"pitch": 0.5}, "ctx")

    def test_rejects_non_boolean_speaker_boost(self):
        with pytest.raises(ValueError, match="use_speaker_boost"):
            validate_voice_settings({"use_speaker_boost": "yes"}, "ctx")

    def test_rejects_boolean_as_number(self):
        with pytest.raises(ValueError, match="stability"):
            validate_voice_settings({"stability": True}, "ctx")

    def test_rejects_non_dict(self):
        with pytest.raises(ValueError, match="object"):
            validate_voice_settings([0.5], "ctx")


class TestSpeakerProfileVoiceSettings:
    _speaker = {
        "name": "Alice",
        "voice_id": "v1",
        "backstory": "b",
        "personality": "p",
    }

    def test_accepts_profile_and_speaker_voice_settings(self):
        profile = SpeakerProfile(
            name="p1",
            speakers=[{**self._speaker, "voice_settings": {"stability": 0.4}}],
            voice_settings={"style": 0.2},
        )
        assert profile.voice_settings == {"style": 0.2}
        assert profile.speakers[0]["voice_settings"] == {"stability": 0.4}

    def test_defaults_to_none(self):
        profile = SpeakerProfile(name="p1", speakers=[dict(self._speaker)])
        assert profile.voice_settings is None

    def test_rejects_invalid_profile_voice_settings(self):
        with pytest.raises(Exception, match="stability"):
            SpeakerProfile(
                name="p1",
                speakers=[dict(self._speaker)],
                voice_settings={"stability": 9},
            )

    def test_rejects_invalid_speaker_voice_settings(self):
        with pytest.raises(Exception, match="speed"):
            SpeakerProfile(
                name="p1",
                speakers=[{**self._speaker, "voice_settings": {"speed": 0.1}}],
            )
