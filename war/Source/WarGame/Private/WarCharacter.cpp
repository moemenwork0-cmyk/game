#include "WarCharacter.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"

AWarCharacter::AWarCharacter()
{
	PrimaryActorTick.bCanEverTick = true;
	GetCapsuleComponent()->InitCapsuleSize(34.f, 90.f);

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(GetCapsuleComponent());
	Camera->SetRelativeLocation(FVector(0.f, 0.f, 70.f));
	Camera->bUsePawnControlRotation = true;
	Camera->SetFieldOfView(HipFov);

	bUseControllerRotationYaw = true;
	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->MaxWalkSpeed = WalkSpeed;
	Move->GetNavAgentPropertiesRef().bCanCrouch = true;
	Move->MaxWalkSpeedCrouched = 180.f;
}

void AWarCharacter::AddLookInput(const FVector2D& Delta)
{
	const float Scale = LookSensitivity * (bAiming ? AimFov / HipFov : 1.f);
	AddControllerYawInput(Delta.X * Scale);
	AddControllerPitchInput(Delta.Y * Scale);
}

void AWarCharacter::SetSprinting(bool bOn)
{
	bSprinting = bOn && !bAiming;
	GetCharacterMovement()->MaxWalkSpeed = bSprinting ? SprintSpeed : WalkSpeed;
}

void AWarCharacter::SetAiming(bool bOn)
{
	bAiming = bOn;
	if (bAiming)
	{
		SetSprinting(false);
	}
}

void AWarCharacter::ToggleCrouch()
{
	if (bIsCrouched)
	{
		UnCrouch();
	}
	else
	{
		Crouch();
	}
}

void AWarCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (Controller && !MoveInput.IsNearlyZero())
	{
		const FRotator Yaw(0.f, Controller->GetControlRotation().Yaw, 0.f);
		AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::X), MoveInput.Y);
		AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::Y), MoveInput.X);
	}

	// Ease the field of view between hip fire and aiming.
	const float TargetFov = bAiming ? AimFov : HipFov;
	Camera->SetFieldOfView(FMath::FInterpTo(Camera->FieldOfView, TargetFov, DeltaSeconds, 12.f));
}
