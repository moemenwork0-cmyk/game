#pragma once

#include "GameFramework/Character.h"
#include "WarCharacter.generated.h"

class UAnimSequence;
class UCameraComponent;
class USkeletalMeshComponent;

// First-person soldier driven by the touch controls (move stick + look drag + buttons).
UCLASS()
class WARGAME_API AWarCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AWarCharacter();

	// Stick in [-1, 1]; X = right, Y = forward.
	void SetMoveInput(const FVector2D& Stick) { MoveInput = Stick; }
	// Look delta in screen points since the last call.
	void AddLookInput(const FVector2D& Delta);

	void SetSprinting(bool bOn);
	void SetAiming(bool bOn);
	void ToggleCrouch();

	// Fire button: the story can claim it (the detonator); otherwise bare-hand punches.
	void Fire();
	TFunction<bool()> FireOverride;
	// Own footsteps (detected from the body's animated feet) for the story's sound mix.
	TFunction<void(const FVector&, float)> OnStep;
	void SetBodyVisible(bool bVisible);

	// Cinematic camera layer (wake-up, blast): offsets on top of the normal eye view.
	void AddShake(float Strength, float Duration);
	void SetCameraPose(const FVector& Offset, const FRotator& Extra) { PoseOffset = Offset; PoseRotation = Extra; }
	// 0..1 each: depth-of-field blur, vignette darkening, colour drained.
	void SetDaze(float Blur, float Dark, float Desaturate);

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "War")
	TObjectPtr<UCameraComponent> Camera;

	// The player's own body (same soldier as the team), head hidden, seen when looking down or punching.
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "War")
	TObjectPtr<USkeletalMeshComponent> Body;

	UPROPERTY()
	TMap<FName, TObjectPtr<UAnimSequence>> Clips;

	UPROPERTY(EditAnywhere, Category = "War|Look")
	float LookSensitivity = 0.12f;

	UPROPERTY(EditAnywhere, Category = "War|Move")
	float WalkSpeed = 330.f;

	UPROPERTY(EditAnywhere, Category = "War|Move")
	float SprintSpeed = 560.f;

	UPROPERTY(EditAnywhere, Category = "War|Look")
	float HipFov = 80.f;

	UPROPERTY(EditAnywhere, Category = "War|Look")
	float AimFov = 55.f;

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	FVector2D MoveInput = FVector2D::ZeroVector;
	FVector PoseOffset = FVector::ZeroVector;
	FRotator PoseRotation = FRotator::ZeroRotator;
	float ShakeStrength = 0.f;
	float ShakeTime = 0.f;
	float ShakeDuration = 0.f;
	float Clock = 0.f;
	bool bSprinting = false;
	bool bAiming = false;
	FName Loco;
	float PunchLeft = 0.f;    // seconds left in the current strike
	float PunchLength = 0.f;
	bool bPunchQueued = false;
	int32 PunchIndex = 0;
	void PlayBody(FName Clip, bool bLoop, float Rate, float Blend);
	void Swing();
	UPROPERTY() TArray<TObjectPtr<class USoundBase>> SwingSounds;
	UPROPERTY() TObjectPtr<class USoundBase> ClothSound;
	float FootMin[2] = { 1e9f, 1e9f };
	bool bFootUp[2] = { false, false };
};
