"""Tests for ElevenLabs voice_settings validation and TTS config merge."""

import pytest

from commands.podcast_commands import merge_voice_settings
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


class TestMergeVoiceSettings:
    def test_noop_without_settings(self):
        sp = {"tts_config": {"api_key": "k"}, "speakers": [{"name": "A"}]}
        merge_voice_settings(sp)
        assert "voice_settings" not in sp["tts_config"]
        assert "tts_config" not in sp["speakers"][0]

    def test_profile_level_settings_merged_into_profile_config(self):
        sp = {
            "voice_settings": {"stability": 0.3},
            "tts_config": {"api_key": "k"},
            "speakers": [{"name": "A"}],
        }
        merge_voice_settings(sp)
        assert sp["tts_config"] == {
            "api_key": "k",
            "voice_settings": {"stability": 0.3},
        }
        # Speaker inherits via profile config: no redundant per-speaker copy
        assert "tts_config" not in sp["speakers"][0]

    def test_speaker_settings_override_profile_key_by_key(self):
        sp = {
            "voice_settings": {"stability": 0.3, "style": 0.2},
            "tts_config": {"api_key": "k"},
            "speakers": [{"name": "A", "voice_settings": {"stability": 0.8}}],
        }
        merge_voice_settings(sp)
        assert sp["speakers"][0]["tts_config"]["voice_settings"] == {
            "stability": 0.8,
            "style": 0.2,
        }
        assert sp["speakers"][0]["tts_config"]["api_key"] == "k"

    def test_profile_settings_survive_speaker_model_override(self):
        # Speaker has its own voice_model => its own resolved tts_config;
        # profile-level settings must still apply to it.
        sp = {
            "voice_settings": {"style": 0.5},
            "tts_config": {"api_key": "k"},
            "speakers": [{"name": "A", "tts_config": {"api_key": "other"}}],
        }
        merge_voice_settings(sp)
        assert sp["speakers"][0]["tts_config"] == {
            "api_key": "other",
            "voice_settings": {"style": 0.5},
        }

    def test_speaker_settings_without_any_profile_config(self):
        sp = {"speakers": [{"name": "A", "voice_settings": {"speed": 1.1}}]}
        merge_voice_settings(sp)
        assert sp["speakers"][0]["tts_config"] == {"voice_settings": {"speed": 1.1}}

    def test_null_voice_settings_treated_as_absent(self):
        sp = {
            "voice_settings": None,
            "tts_config": {"api_key": "k"},
            "speakers": [{"name": "A", "voice_settings": None}],
        }
        merge_voice_settings(sp)
        assert "voice_settings" not in sp["tts_config"]
        assert "tts_config" not in sp["speakers"][0]


class TestSpeakerProfileApiSchema:
    def test_create_schema_accepts_voice_settings(self):
        from api.routers.speaker_profiles import SpeakerProfileCreate

        data = SpeakerProfileCreate(
            name="p1",
            speakers=[
                {
                    "name": "Alice",
                    "voice_id": "v1",
                    "backstory": "b",
                    "personality": "p",
                    "voice_settings": {"stability": 0.4},
                }
            ],
            voice_settings={"style": 0.2},
        )
        assert data.voice_settings == {"style": 0.2}

    def test_response_includes_voice_settings(self):
        from api.routers.speaker_profiles import _profile_to_response

        profile = SpeakerProfile(
            name="p1",
            speakers=[
                {
                    "name": "Alice",
                    "voice_id": "v1",
                    "backstory": "b",
                    "personality": "p",
                }
            ],
            voice_settings={"stability": 0.6},
        )
        response = _profile_to_response(profile)
        assert response.voice_settings == {"stability": 0.6}
