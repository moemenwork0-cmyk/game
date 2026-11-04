#include "WarFX.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/Texture2D.h"
#include "Engine/World.h"
#include "Camera/PlayerCameraManager.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

AWarFX::AWarFX()
{
	PrimaryActorTick.bCanEverTick = true;
	Sprite = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Sprite"));
	RootComponent = Sprite;
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Plane(TEXT("/Engine/BasicShapes/Plane.Plane"));
	Sprite->SetStaticMesh(Plane.Object);
	Sprite->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Sprite->CastShadow = false;
	Sprite->SetHiddenInGame(true);
}

AWarFX* AWarFX::Spawn(UWorld* World, UMaterialInterface* Material, const FVector& Where, const FSpec& InSpec)
{
	if (!World || !Material || !InSpec.Texture)
	{
		return nullptr;
	}
	AWarFX* FX = World->SpawnActor<AWarFX>(Where, FRotator::ZeroRotator);
	FX->Spec = InSpec;
	FX->Roll = FMath::FRandRange(0.f, 360.f);
	FX->Mid = UMaterialInstanceDynamic::Create(Material, FX);
	FX->Mid->SetTextureParameterValue("Tex", InSpec.Texture);
	FX->Mid->SetScalarParameterValue("Cols", InSpec.Cols);
	FX->Mid->SetScalarParameterValue("Rows", InSpec.Rows);
	FX->Mid->SetVectorParameterValue("Tint", InSpec.Tint);
	FX->Sprite->SetMaterial(0, FX->Mid);
	FX->Tick(0.f);
	return FX;
}

void AWarFX::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!Mid)
	{
		return;
	}
	Age += DeltaSeconds;
	const float T = (Age - Spec.Delay) / Spec.Duration;
	if (T < 0.f)
	{
		return;
	}
	if (T >= 1.f)
	{
		Destroy();
		return;
	}
	Sprite->SetHiddenInGame(false);
	const float Ease = 1.f - FMath::Square(1.f - T);
	const float Size = FMath::Lerp(Spec.StartSize, Spec.EndSize, Ease);
	SetActorLocation(GetActorLocation() + Spec.Velocity * DeltaSeconds);

	// Face the camera: the engine plane lies in XY with its normal up (+Z).
	if (APlayerCameraManager* Cam = UGameplayStatics::GetPlayerCameraManager(this, 0))
	{
		const FVector ToCam = (Cam->GetCameraLocation() - GetActorLocation()).GetSafeNormal();
		FRotator R = FRotationMatrix::MakeFromZX(ToCam, FVector::UpVector).Rotator();
		SetActorRotation(FQuat(ToCam, FMath::DegreesToRadians(Roll)) * R.Quaternion());
	}
	SetActorScale3D(FVector(Size / 100.f));

	const int32 Frames = Spec.Cols * Spec.Rows;
	Mid->SetScalarParameterValue("Frame", FMath::Min(FMath::FloorToInt(T * Frames), Frames - 1));
	const float In = Spec.FadeIn > 0.f ? FMath::Clamp(T / Spec.FadeIn, 0.f, 1.f) : 1.f;
	const float Out = Spec.FadeOut > 0.f ? FMath::Clamp((1.f - T) / Spec.FadeOut, 0.f, 1.f) : 1.f;
	Mid->SetScalarParameterValue("Opacity", In * Out);
	Mid->SetScalarParameterValue("Glow", Spec.Glow);
}
