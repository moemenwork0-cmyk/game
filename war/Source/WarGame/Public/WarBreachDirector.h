#pragma once

#include "GameFramework/Actor.h"
#include "WarBreachDirector.generated.h"

class AWarCharacter;
class AWarPlayerController;
class AWarSoldier;
class UAudioComponent;
class UMaterialInterface;
class UPointLightComponent;
class USoundBase;
class UStaticMesh;
class UStaticMeshComponent;
class UTexture2D;

// Runs part 1 end to end: wake-up, the team walks to the bunker and plants two charges, turns to
// the player and waits for the detonator; on the press a 3-2-1 countdown, the team sprints and
// dives, the blast throws the rocks plugging the entrance, and the team waves the player in.
// Placed in the map by Tools/Editor/build_breach.py; everything else is spawned here.
UCLASS()
class WARGAME_API AWarBreachDirector : public AActor
{
	GENERATED_BODY()

public:
	AWarBreachDirector();

	// Bunker front centre (where the charges go) and the direction the entrance faces.
	UPROPERTY(EditAnywhere, Category = "War")
	FVector Door = FVector(2150.f, 0.f, 0.f);

	UPROPERTY(EditAnywhere, Category = "War")
	float MeshYaw = -90.f;

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	enum class EPhase : uint8 { Waiting, Intro, Ready, Countdown, After };

	struct FCue
	{
		float At;
		TFunction<void()> Run;
	};

	void Cue(float At, TFunction<void()> Run) { Cues.Add({At, MoveTemp(Run)}); }
	void StartIntro();
	void Detonate();
	void Blast();
	void Sound(const TCHAR* Name, float Volume = 1.f, const FVector* Where = nullptr);
	UAudioComponent* Loop(const TCHAR* Name, float Volume);
	void Muffle(bool bOn);
	void SpawnFX(const TCHAR* Sheet, const FVector& Where, float Duration, float From, float To, const FVector& Vel,
		FLinearColor Tint, float Glow, float Delay = 0.f, float Peak = 1.f);
	void SpawnDistantBlast();
	AWarSoldier* SpawnSoldier(const FVector& Where, float Yaw);
	UStaticMeshComponent* SpawnProp(UStaticMesh* Mesh, float SizeCm, USceneComponent* AttachTo = nullptr);
	void Look(const FVector& Point, float Speed);

	EPhase Phase = EPhase::Waiting;
	float Time = 0.f;
	TArray<FCue> Cues;
	bool bAuto = false;
	bool bCapture = false;

	UPROPERTY() TObjectPtr<AWarCharacter> Player;
	UPROPERTY() TObjectPtr<AWarPlayerController> PC;
	UPROPERTY() TObjectPtr<AWarSoldier> Alpha;
	UPROPERTY() TObjectPtr<AWarSoldier> Bravo;
	UPROPERTY() TObjectPtr<UMaterialInterface> FlipbookMaterial;
	UPROPERTY() TObjectPtr<UMaterialInterface> FireMaterial;
	UPROPERTY() TMap<FString, TObjectPtr<UTexture2D>> Sheets;
	UPROPERTY() TMap<FString, TObjectPtr<USoundBase>> Sounds;
	UPROPERTY() TArray<TObjectPtr<UAudioComponent>> Loops;
	UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Charges;
	UPROPERTY() TArray<TObjectPtr<UPointLightComponent>> ChargeLights;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> Detonator;
	UPROPERTY() TObjectPtr<UPointLightComponent> BlastLight;
	UPROPERTY() TObjectPtr<UStaticMesh> RockMesh;

	struct FDebris
	{
		TWeakObjectPtr<AActor> Actor;
		FVector Velocity;
		FRotator Spin;
	};
	TArray<FDebris> Debris;

	FVector LookPoint = FVector::ZeroVector;
	float LookSpeed = 0.f;
	float DetonatorPress = -1.f;
	float FlashLevel = 0.f;
	float BlastLightLevel = 0.f;
	float BeepClock = 0.f;
	bool bChargesArmed = false;
	int32 ReadyCount = 0;
	float DoorHalfWidth = 600.f;
	bool bReadyShown = false;
};
