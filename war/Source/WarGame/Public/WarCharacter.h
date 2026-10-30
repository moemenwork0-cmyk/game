#pragma once

#include "GameFramework/Character.h"
#include "WarCharacter.generated.h"

class UCameraComponent;

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

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "War")
	TObjectPtr<UCameraComponent> Camera;

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
	virtual void Tick(float DeltaSeconds) override;

private:
	FVector2D MoveInput = FVector2D::ZeroVector;
	bool bSprinting = false;
	bool bAiming = false;
};
