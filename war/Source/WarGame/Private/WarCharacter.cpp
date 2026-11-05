#include "WarCharacter.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "WarAnimInstance.h"
#include "Animation/AnimSequence.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundBase.h"

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

	Body = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("Body"));
	Body->SetupAttachment(GetCapsuleComponent());
	Body->SetAnimationMode(EAnimationMode::AnimationBlueprint);
	Body->SetAnimInstanceClass(UWarAnimInstance::StaticClass());
	Body->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Body->CastShadow = true;
	Body->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;

	bUseControllerRotationYaw = true;
	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->MaxWalkSpeed = WalkSpeed;
	Move->GetNavAgentPropertiesRef().bCanCrouch = true;
	Move->MaxWalkSpeedCrouched = 180.f;
}

void AWarCharacter::BeginPlay()
{
	Super::BeginPlay();
	if (USkeletalMesh* M = LoadObject<USkeletalMesh>(nullptr, TEXT("/Game/Chars/Soldier/Soldier.Soldier")))
	{
		Body->SetSkeletalMesh(M);
		const FBoxSphereBounds B = M->GetBounds();
		const float H = FMath::Max(B.BoxExtent.Z * 2.f, 1.f);
		const float K = 180.f / H;
		// Feet on the capsule floor, a little behind the eye so the chest is seen, not the inside of the neck.
		Body->SetRelativeScale3D(FVector(K));
		Body->SetRelativeLocation(FVector(-14.f, 0.f, -90.f - (B.Origin.Z - B.BoxExtent.Z) * K));
		Body->SetRelativeRotation(FRotator(0.f, -90.f, 0.f));
		for (const TCHAR* Bone : { TEXT("mixamorig:Head"), TEXT("mixamorig_Head") })
		{
			if (Body->GetBoneIndex(Bone) != INDEX_NONE)
			{
				Body->HideBoneByName(Bone, EPhysBodyOp::PBO_None);
			}
		}
	}
	for (const TCHAR* Name : { TEXT("Breathing_Idle"), TEXT("Walking"), TEXT("Running"), TEXT("Punch_Combo"), TEXT("Hook") })
	{
		Clips.Add(Name, LoadObject<UAnimSequence>(nullptr, *FString::Printf(TEXT("/Game/Chars/Soldier/Anim_%s.Anim_%s"), Name, Name)));
	}
	PlayBody("Breathing_Idle", true, 1.f, 0.f);
	Loco = "Breathing_Idle";
	for (const TCHAR* Name : { TEXT("Whoosh"), TEXT("Whoosh2") })
	{
		if (USoundBase* S = LoadObject<USoundBase>(nullptr, *FString::Printf(TEXT("/Game/Audio/S_%s.S_%s"), Name, Name)))
		{
			SwingSounds.Add(S);
		}
	}
	ClothSound = LoadObject<USoundBase>(nullptr, TEXT("/Game/Audio/S_Cloth.S_Cloth"));
}

void AWarCharacter::SetBodyVisible(bool bVisible)
{
	Body->SetVisibility(bVisible, true);
}

void AWarCharacter::PlayBody(FName Clip, bool bLoop, float Rate, float Blend)
{
	UWarAnimInstance* A = Cast<UWarAnimInstance>(Body->GetAnimInstance());
	UAnimSequence* Seq = Clips.FindRef(Clip);
	if (A && Seq)
	{
		A->Play(Seq, bLoop, Rate, Blend);
	}
}

void AWarCharacter::Swing()
{
	// A fist cutting the air: a gloved whoosh, slightly varied, with the sleeve's rustle.
	if (SwingSounds.Num() > 0)
	{
		UGameplayStatics::PlaySound2D(this, SwingSounds[FMath::RandRange(0, SwingSounds.Num() - 1)], FMath::FRandRange(0.5f, 0.7f),
			FMath::FRandRange(0.92f, 1.1f));
	}
	if (ClothSound)
	{
		UGameplayStatics::PlaySound2D(this, ClothSound, 0.3f, FMath::FRandRange(0.9f, 1.15f));
	}
}

void AWarCharacter::Fire()
{
	if (FireOverride)
	{
		// Copy first: the handler may clear FireOverride while it runs.
		const TFunction<bool()> Handler = FireOverride;
		if (Handler())
		{
			return;
		}
	}
	if (PunchLeft > 0.f)
	{
		bPunchQueued = true;  // chain the next strike when this one lands
		return;
	}
	PunchIndex = 0;
	const FName Clip = "Punch_Combo";
	PunchLength = Clips.FindRef(Clip) ? Clips.FindRef(Clip)->GetPlayLength() / 1.15f : 1.f;
	PunchLeft = PunchLength;
	PlayBody(Clip, false, 1.15f, 0.1f);
	Swing();
	Loco = NAME_None;
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

	// Strikes: Punch_Combo, then Hook while the player keeps pressing, alternating; back to idle/walk.
	if (PunchLeft > 0.f)
	{
		PunchLeft -= DeltaSeconds;
		if (bPunchQueued && PunchLeft < PunchLength * 0.3f)
		{
			bPunchQueued = false;
			PunchIndex = (PunchIndex + 1) % 2;
			const FName Clip = PunchIndex == 1 ? FName("Hook") : FName("Punch_Combo");
			const float Rate = PunchIndex == 1 ? 1.25f : 1.15f;
			PunchLength = Clips.FindRef(Clip) ? Clips.FindRef(Clip)->GetPlayLength() / Rate : 1.f;
			PunchLeft = PunchLength;
			PlayBody(Clip, false, Rate, 0.12f);
			Swing();
		}
	}
	else
	{
		// Body locomotion follows the real speed so feet keep pace (clip speeds from prep_soldier.py).
		const float V = GetVelocity().Size2D();
		const FName Want = V < 30.f ? FName("Breathing_Idle") : (V < 420.f ? FName("Walking") : FName("Running"));
		if (Want != Loco)
		{
			const float Rate = Want == "Walking" ? V / 169.f : (Want == "Running" ? V / 560.f : 1.f);
			PlayBody(Want, true, FMath::Clamp(Rate, 0.6f, 1.6f), 0.25f);
			Loco = Want;
		}
	}

	// Own footsteps from the body's toes (same rule as the team: a toe settling back to its lowest).
	if (Body->IsVisible() && OnStep)
	{
		const FName Toes[2] = { TEXT("mixamorig:LeftToeBase"), TEXT("mixamorig:RightToeBase") };
		for (int32 i = 0; i < 2; ++i)
		{
			if (Body->GetBoneIndex(Toes[i]) == INDEX_NONE) continue;
			const float Z = Body->GetBoneLocation(Toes[i]).Z;
			FootMin[i] = FMath::Min(FootMin[i] + 6.f * DeltaSeconds, Z);
			if (Z > FootMin[i] + 7.f) { bFootUp[i] = true; }
			else if (bFootUp[i] && Z < FootMin[i] + 2.5f && GetVelocity().Size2D() > 30.f)
			{
				bFootUp[i] = false;
				OnStep(Body->GetBoneLocation(Toes[i]), GetVelocity().Size2D());
			}
		}
	}

	// Ease the field of view between hip fire and aiming.
	const float TargetFov = bAiming ? AimFov : HipFov;
	Camera->SetFieldOfView(FMath::FInterpTo(Camera->FieldOfView, TargetFov, DeltaSeconds, 12.f));
}
