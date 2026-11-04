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
	// The camera follows the control rotation from Tick, so shake and roll can be layered on top.
	Camera->bUsePawnControlRotation = false;
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

void AWarCharacter::AddShake(float Strength, float Duration)
{
	ShakeStrength = FMath::Max(ShakeStrength * (1.f - ShakeTime / FMath::Max(ShakeDuration, 0.01f)), Strength);
	ShakeDuration = Duration;
	ShakeTime = 0.f;
}

void AWarCharacter::SetDaze(float Blur, float Dark, float Desaturate)
{
	FPostProcessSettings& PP = Camera->PostProcessSettings;
	Camera->PostProcessBlendWeight = 1.f;
	PP.bOverride_DepthOfFieldFocalDistance = Blur > 0.01f;
	PP.bOverride_DepthOfFieldFstop = Blur > 0.01f;
	PP.bOverride_DepthOfFieldScale = Blur > 0.01f;
	PP.DepthOfFieldFocalDistance = 15.f;
	PP.DepthOfFieldFstop = FMath::Lerp(16.f, 0.7f, Blur);
	PP.DepthOfFieldScale = 2.f * Blur;
	PP.bOverride_VignetteIntensity = true;
	PP.VignetteIntensity = 0.4f + 1.1f * Dark;
	PP.bOverride_ColorSaturation = true;
	const float Sat = 1.f - 0.8f * Desaturate;
	PP.ColorSaturation = FVector4(Sat, Sat, Sat, 1.f);
	PP.bOverride_SceneFringeIntensity = true;
	PP.SceneFringeIntensity = 4.f * FMath::Max(Blur, Desaturate);
}

void AWarCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Clock += DeltaSeconds;

	// Eye view = control rotation + cinematic pose + decaying Perlin shake.
	FRotator Shake = FRotator::ZeroRotator;
	FVector ShakeLoc = FVector::ZeroVector;
	if (ShakeTime < ShakeDuration)
	{
		ShakeTime += DeltaSeconds;
		const float Fall = FMath::Square(1.f - FMath::Clamp(ShakeTime / ShakeDuration, 0.f, 1.f));
		const float A = ShakeStrength * Fall;
		const float T = Clock * 22.f;
		Shake = FRotator(FMath::PerlinNoise1D(T) * 6.f, FMath::PerlinNoise1D(T + 37.f) * 6.f, FMath::PerlinNoise1D(T + 71.f) * 4.f) * A;
		ShakeLoc = FVector(0.f, FMath::PerlinNoise1D(T + 13.f), FMath::PerlinNoise1D(T + 53.f)) * 9.f * A;
	}
	const FRotator View = (Controller ? Controller->GetControlRotation() : GetActorRotation()) + PoseRotation + Shake;
	Camera->SetRelativeLocation(FVector(0.f, 0.f, 70.f) + PoseOffset + ShakeLoc);
	Camera->SetWorldRotation(View);

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
